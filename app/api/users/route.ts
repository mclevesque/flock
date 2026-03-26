import { NextResponse, NextRequest } from "next/server";
import { getAllUsers, getUserByUsername, getUserById, updateUser } from "@/lib/db";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.id === "warrior_guest") return NextResponse.json({ error: "Guest accounts cannot edit their profile." }, { status: 403 });
  try {
    const body = await req.json();
    const allowed = ["banner_url", "avatar_url", "bio", "display_name", "location", "website"];
    const fields: Record<string, string> = {};
    for (const key of allowed) { if (body[key] !== undefined) fields[key] = body[key]; }
    if (Object.keys(fields).length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    await updateUser(session.user.id, fields);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "DB error" }, { status: 500 }); }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  const id = searchParams.get("id");

  try {
    if (id) {
      const user = await getUserById(id);
      return NextResponse.json(user ?? { error: "Not found" });
    }
    if (username) {
      const user = await getUserByUsername(username);
      return NextResponse.json(user ?? { error: "Not found" });
    }
    const users = await getAllUsers();
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
