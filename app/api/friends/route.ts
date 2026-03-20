import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFriendsWithOnline } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  try {
    const friends = await getFriendsWithOnline(session.user.id);
    return NextResponse.json(friends);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
