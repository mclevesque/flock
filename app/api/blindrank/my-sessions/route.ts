import { auth } from "@/auth";
import { getUserBlindRankSessions } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.name) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    const sessions = await getUserBlindRankSessions(session.user.name);
    return Response.json({ sessions });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}
