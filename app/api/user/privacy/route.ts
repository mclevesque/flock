import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserReplyPrivacy, updateUserReplyPrivacy } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const setting = await getUserReplyPrivacy(session.user.id);
  return NextResponse.json({ reply_privacy: setting });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { reply_privacy } = await req.json().catch(() => ({}));
  if (!["anyone", "friends_only"].includes(reply_privacy)) {
    return NextResponse.json({ error: "Invalid setting" }, { status: 400 });
  }
  await updateUserReplyPrivacy(session.user.id, reply_privacy);
  return NextResponse.json({ ok: true });
}
