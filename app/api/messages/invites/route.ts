import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRecentGameInvites } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  const invites = await getRecentGameInvites(session.user.id);
  return NextResponse.json(invites);
}
