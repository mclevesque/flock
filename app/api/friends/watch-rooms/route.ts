import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFriendsInWatchRooms } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 200 });

  try {
    const data = await getFriendsInWatchRooms(session.user.id);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
