import { NextRequest, NextResponse } from "next/server";

// Known crawler/bot patterns — blocked from API routes to prevent DB wakeups
const BOT_PATTERN = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|semrush|ahrefs|mj12bot|dotbot|petalbot|applebot|twitterbot|linkedinbot|discordbot|telegrambot|whatsapp|facebookexternalhit/i;

export default function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";

  // Block bots from all API routes — 204 with no body, Neon stays asleep
  if (BOT_PATTERN.test(ua) && req.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
