import { getUserByUsername, updateUserPassword } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { username, newPassword } = await req.json();
    if (!username?.trim() || !newPassword?.trim()) {
      return Response.json({ error: "Username and password required" }, { status: 400 });
    }

    const user = await getUserByUsername(username.toLowerCase());
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await updateUserPassword(user.id as string, hashedPassword);
    return Response.json({ success: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Reset failed" }, { status: 500 });
  }
}
