import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrivileges, upsertPrivileges } from "@/lib/db";

const MODERATORS = ["mclevesque"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  try {
    const privileges = await getPrivileges(userId);
    return NextResponse.json(privileges);
  } catch {
    return NextResponse.json({ error: "Failed to fetch privileges" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const username = session?.user?.name?.toLowerCase() ?? "";
  if (!MODERATORS.includes(username)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  try {
    const { userId, ...patch } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    await upsertPrivileges(userId, patch, username);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update privileges" }, { status: 500 });
  }
}
