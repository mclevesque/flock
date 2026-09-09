import { NextRequest, NextResponse } from "next/server";

// Known crawler/bot patterns — blocked from API routes to prevent DB wakeups
const BOT_PATTERN = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|semrush|ahrefs|mj12bot|dotbot|petalbot|applebot|twitterbot|linkedinbot|discordbot|telegrambot|whatsapp|facebookexternalhit/i;

/**
 * Hostnames that are DraftMasters' own site rather than Great Souls.
 *
 * One deployment serves both. Nothing forks: same Netlify project, same Neon
 * database, same R2 bucket, same NextAuth secret and the same accounts — the
 * only difference is which host the request arrived on. That is why moving to
 * a second domain needs no migration at all.
 *
 * Stored portrait URLs are absolute (pub-….r2.dev/…), so every picture already
 * curated keeps working on the new domain without being touched.
 */
const DRAFTMASTERS_HOSTS = new Set([
  "draftmasters.net",
  "www.draftmasters.net",
]);

/**
 * Paths that keep working as-is on the DraftMasters host.
 *
 * `/api` has to pass through or nothing works — that is where the board, the
 * judge, the portraits AND NextAuth all live. `/signin` and `/reset-password`
 * pass through because logging in is the whole point of sharing the backend.
 */
const SHARED_PREFIXES = [
  "/draftmasters",
  "/api",
  "/signin",
  "/reset-password",
  "/share",
  "/_next",
  "/.netlify",
];

function isDraftMastersHost(req: NextRequest): boolean {
  // Host, not the URL: behind Netlify the request URL is internal.
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  return DRAFTMASTERS_HOSTS.has(host);
}

export default function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  const { pathname } = req.nextUrl;

  // Block bots from all API routes — 204 with no body, Neon stays asleep
  if (BOT_PATTERN.test(ua) && pathname.startsWith("/api/")) {
    return new NextResponse(null, { status: 204 });
  }

  if (isDraftMastersHost(req)) {
    // The game at the root of its own domain.
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/draftmasters";
      // Rewrite, not redirect: the address bar stays on the bare domain.
      return NextResponse.rewrite(url);
    }

    // Short links for the tools, so they can be handed to somebody in a message
    // without the doubled path. `/portraits` is the one that actually gets
    // shared — it is how a second person fixes pictures on a board without
    // needing anything installed.
    const SHORTCUTS: Record<string, string> = {
      "/portraits": "/draftmasters/portraits",
    };
    const shortcut = SHORTCUTS[pathname.replace(/\/$/, "")];
    if (shortcut) {
      const url = req.nextUrl.clone();
      url.pathname = shortcut;
      return NextResponse.rewrite(url);
    }

    // Everything DraftMasters needs, plus the shared plumbing.
    if (SHARED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return NextResponse.next();
    }

    // Anything else is a Great Souls page that has no business being reachable
    // here — /outbreak and /messages on the DraftMasters domain would just be
    // confusing. Send them to the game rather than 404ing.
    const home = req.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
