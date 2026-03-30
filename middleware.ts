import { NextRequest, NextResponse } from "next/server";

// Known crawler/bot patterns — these should never hit API routes or trigger DB queries
const BOT_PATTERN = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|semrush|ahrefs|mj12bot|dotbot|petalbot|applebot|twitterbot|linkedinbot|discordbot|telegrambot|whatsapp|facebookexternalhit/i;

export default function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";

  // Block bots from hitting API routes — return empty 204 so they don't wake Neon
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
