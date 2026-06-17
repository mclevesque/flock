import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createBlindRankSession } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { topic, items, useImages } = await req.json().catch(() => ({}));
  if (!topic?.trim() || !Array.isArray(items) || items.length < 2) {
    return NextResponse.json({ error: "Need a topic and at least 2 items" }, { status: 400 });
  }
  const capped = (items as string[]).slice(0, 12).map(s => String(s).trim()).filter(Boolean);
  if (capped.length < 2) return NextResponse.json({ error: "Need at least 2 valid items" }, { status: 400 });

  const session = await auth();
  const createdBy = session?.user?.name ?? null;
  try {
    const id = await createBlindRankSession(topic.trim(), capped, !!useImages, createdBy);
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
