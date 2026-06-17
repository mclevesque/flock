import { NextRequest, NextResponse } from "next/server";
import { getBlindRankResults } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const results = await getBlindRankResults(id);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
