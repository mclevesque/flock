import { NextRequest, NextResponse } from "next/server";

// Known crawler/bot patterns — blocked from API routes to prevent DB wakeups
const BOT_PATTERN = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|semrush|ahrefs|mj12bot|dotbot|petalbot|applebot|twitterbot|linkedinbot|discordbot|telegrambot|whatsapp|facebookexternalhit/i;

// Routes that don't require a session
const PUBLIC_PATHS = ["/signin", "/api/auth"];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ua = req.headers.get("user-agent") ?? "";

  // Block bots from all API routes — 204 with no body, Neon stays asleep
  if (BOT_PATTERN.test(ua) && pathname.startsWith("/api/")) {
    return new NextResponse(null, { status: 204 });
  }

  // Allow public paths through without session check
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for NextAuth v5 session cookie (http or https variant)
  const sessionCookie =
    req.cookies.get("authjs.session-token") ??
    req.cookies.get("__Secure-authjs.session-token");

  if (!sessionCookie) {
    // API calls from an unauthenticated context → 401 (no redirect loop)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Page requests → redirect to /signin, preserving destination
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
