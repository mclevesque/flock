import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/db";

function dicebearFallback(seed: string) {
  return NextResponse.redirect(
    `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(seed)}`,
    { status: 302, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const user = await getUserById(userId) as { avatar_url?: string; username?: string } | null;
    const url = user?.avatar_url;

    if (url) {
      // Skip old Vercel Blob URLs — broken after migration to R2
      const isVercelBlob = url.includes("vercel-storage.com");
      if (!isVercelBlob) {
        // Handle relative URLs (e.g. /api/generate-image?...) by making them absolute
        const absoluteUrl = url.startsWith("/")
          ? `${new URL(_req.url).origin}${url}`
          : url;
        if (absoluteUrl.startsWith("http://") || absoluteUrl.startsWith("https://")) {
          return NextResponse.redirect(absoluteUrl, {
            status: 302,
            headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
          });
        }
      }
    }

    // No real avatar — generated pixel-art avatar from username (never a blank silhouette)
    return dicebearFallback(user?.username ?? userId);
  } catch {
    return dicebearFallback("unknown");
  }
}
