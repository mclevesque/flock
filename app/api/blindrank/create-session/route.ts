import { createBlindRankSession } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { topic, items, useImages, createdBy } = await req.json();
    if (!topic?.trim() || !Array.isArray(items) || items.length < 2) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }
    const sessionId = await createBlindRankSession(topic, items, !!useImages, createdBy || null);
    return Response.json({ sessionId });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to create session" }, { status: 500 });
  }
}
