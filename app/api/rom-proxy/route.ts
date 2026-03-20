import { NextRequest, NextResponse } from "next/server";

// Just resolves the redirect chain — no ROM bytes flow through Vercel
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const romUrl = searchParams.get("url");

  if (!romUrl) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  // Only allow archive.org URLs to prevent abuse
  let parsed: URL;
  try {
    parsed = new URL(romUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!parsed.hostname.endsWith("archive.org")) {
    return NextResponse.json({ error: "Only archive.org URLs are allowed" }, { status: 403 });
  }

  try {
    // HEAD request to resolve archive.org's redirect chain to the final CDN URL.
    // The final CDN (ia8xxxxx.us.archive.org) serves with Access-Control-Allow-Origin: *
    // so the browser can fetch it directly without any proxy involvement.
    const res = await fetch(romUrl, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible)",
        "Referer": "https://archive.org/",
      },
      redirect: "follow",
    });

    // res.url is the resolved CDN URL after all redirects
    const finalUrl = res.url && res.url !== romUrl ? res.url : romUrl;

    // Redirect the browser straight to the CDN — zero ROM bytes through Vercel
    return NextResponse.redirect(finalUrl, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    // If HEAD resolution fails, fall back to redirecting to the original URL
    return NextResponse.redirect(romUrl, { status: 302 });
  }
}
