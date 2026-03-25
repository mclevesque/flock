import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  const path = req.nextUrl.pathname;

  // Skip onboarding check for these paths
  const skip = ["/onboarding", "/signin", "/sso-callback", "/api/", "/_next/", "/favicon"];
  if (skip.some((s) => path.startsWith(s))) return NextResponse.next();

  // If signed in via Clerk but no username set yet → force onboarding
  // Skip redirect if they already have username in JWT or bypass cookie is set
  if (userId) {
    const meta = (sessionClaims?.publicMetadata ?? {}) as { username?: string };
    const justOnboarded = req.cookies.get("clerk_onboarded")?.value === "1";

    if (!meta.username && !justOnboarded) {
      // JWT may be stale — do a quick DB check before redirecting
      try {
        const checkUrl = new URL("/api/onboarding/check", req.url);
        const checkRes = await fetch(checkUrl.toString(), {
          headers: { "x-ryft-uid": userId },
        });
        const data = await checkRes.json();
        if (data.hasUsername) {
          // User already onboarded — set long-lived cookie so we don't hit DB again
          const res = NextResponse.next();
          res.cookies.set("clerk_onboarded", "1", {
            maxAge: 60 * 60 * 24 * 30,
            path: "/",
            httpOnly: true,
            sameSite: "lax",
          });
          return res;
        }
      } catch {
        // DB check failed — don't block, let onboarding handle it
      }
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
