import { NextRequest, NextResponse } from "next/server";
import { upsertBlindRankSession, submitBlindRankResult } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { sessionId, topic, items, useImages, createdBy, ranking, rankerName } =
    await req.json().catch(() => ({}));

  if (!sessionId || !topic || !Array.isArray(items) || !Array.isArray(ranking) || ranking.length === 0) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }
  try {
    await upsertBlindRankSession(sessionId, topic, items as string[], !!useImages, createdBy ?? null);
    const id = await submitBlindRankResult(sessionId, ranking as string[], rankerName?.trim() || null);
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: "Failed to save result" }, { status: 500 });
  }
}
