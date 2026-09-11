import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/db";
import { defaultPortraitFor } from "@/lib/avatars";

/**
 * No usable photo: send them to their drawn portrait. Seeded by the user id so
 * it is the same drawing the client picks when it seeds by id.
 */
function portraitFallback(req: NextRequest, seed: string) {
  return NextResponse.redirect(new URL(defaultPortraitFor(seed), req.url), {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  let seed = "unknown";
  try {
    const { userId } = await params;
    seed = userId;
    const user = await getUserById(userId) as { avatar_url?: string } | null;
    const url = user?.avatar_url;

    if (url) {
      // Skip old Vercel Blob URLs — broken after migration to R2
      const isVercelBlob = url.includes("vercel-storage.com");
      if (!isVercelBlob) {
        const absoluteUrl = url.startsWith("/")
          ? `${new URL(req.url).origin}${url}`
          : url;
        if (absoluteUrl.startsWith("http://") || absoluteUrl.startsWith("https://")) {
          // Proxy the image — avoids CORS issues when Phaser loads canvas textures
          try {
            const img = await fetch(absoluteUrl);
            if (img.ok) {
              const contentType = img.headers.get("content-type") ?? "image/jpeg";
              return new NextResponse(img.body, {
                headers: {
                  "Content-Type": contentType,
                  "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
                  "Access-Control-Allow-Origin": "*",
                },
              });
            }
          } catch { /* fall through to the portrait */ }
        }
      }
    }

    // No real avatar — their drawn portrait (never a blank silhouette or a letter)
    return portraitFallback(req, seed);
  } catch {
    return portraitFallback(req, seed);
  }
}
