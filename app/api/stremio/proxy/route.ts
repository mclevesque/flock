import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// Proxies requests to Stremio addon URLs to avoid CORS issues.
// Only proxies JSON responses from known Stremio addon patterns.
// greatsouls.net never stores or caches stream data.

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await req.json().catch(() => ({}));
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Only allow requests to known Stremio addon URL patterns
  // Must end in .json and be HTTPS (or localhost for Stremio desktop)
  if (!url.endsWith(".json")) {
    return NextResponse.json({ error: "Invalid URL — must end in .json" }, { status: 400 });
  }

  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && !parsed.hostname.startsWith("127.0.0.1") && parsed.hostname !== "localhost") {
    return NextResponse.json({ error: "Only HTTPS addon URLs allowed" }, { status: 400 });
  }

  try {
    console.log("[stremio-proxy] Fetching:", url);
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    console.log("[stremio-proxy] Response:", res.status, url.slice(0, 80));

    if (!res.ok) {
      return NextResponse.json({ error: `Addon returned ${res.status}` }, { status: res.status });
    }

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      console.log("[stremio-proxy] Non-JSON response from:", url.slice(0, 80), text.slice(0, 200));
      return NextResponse.json({ error: "Addon returned non-JSON response" }, { status: 502 });
    }
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : "Fetch failed";
    console.error("[stremio-proxy] Fetch error:", msg, "URL:", url.slice(0, 120));
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
