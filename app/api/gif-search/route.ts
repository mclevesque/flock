import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ data: [] });
  try {
    const url = q.trim()
      ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=20&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=20&rating=pg-13`;
    const res = await fetch(url);
    const json = await res.json();
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ data: [] });
  }
}
