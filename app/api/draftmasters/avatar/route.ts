import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { PORTRAITS, portraitUrl } from "@/lib/avatars";
import { safeUserId, signAvatarToken } from "@/lib/draftmasters/avatar-token";

/**
 * Your face on the site.
 *
 *   GET                      a signed slip for netlify/functions/avatar-store
 *   POST { portrait: "mage" } use one of the drawn portraits
 *   POST { url }             use a photo that has just been uploaded
 *
 * The photo itself never passes through here — it is cropped and shrunk in the
 * browser and written to R2 by the Netlify function, because R2 writes from a
 * Next route do not survive the production build (lib/storage.ts). This route
 * only hands out permission and records the result.
 *
 * A URL is accepted only if it is under this user's own avatars/ prefix in our
 * bucket. Without that check anybody could point their avatar at any image on
 * the internet and every friend's drawer would load it.
 */

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const token = signAvatarToken(me);
  // No secret configured: the client falls back to the older upload route.
  return NextResponse.json({ token });
}

export async function POST(req: Request) {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { portrait?: string; url?: string };

  let avatar: string | null = null;
  if (body.portrait) {
    const hit = PORTRAITS.find((p) => p.id === body.portrait);
    if (!hit) return NextResponse.json({ error: "No portrait by that name." }, { status: 400 });
    avatar = portraitUrl(hit.id);
  } else if (body.url) {
    const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
    const url = String(body.url);
    // The Netlify function writes under the path-safe id; the older Next
    // upload route writes under the raw id. Either is this user's own file.
    const mine = [safeUserId(me), me].map((id) => `${base}/avatars/${id}_`);
    if (!base || !mine.some((prefix) => url.startsWith(prefix)) || url.length > 400) {
      return NextResponse.json({ error: "That photo did not come from your upload." }, { status: 400 });
    }
    avatar = url;
  } else {
    return NextResponse.json({ error: "Pick a portrait or upload a photo." }, { status: 400 });
  }

  try {
    await sql`UPDATE users SET avatar_url = ${avatar} WHERE id = ${me}`;
  } catch (err) {
    console.error("[draftmasters/avatar] save failed", err);
    return NextResponse.json({ error: "Couldn't save that right now." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, avatar });
}
