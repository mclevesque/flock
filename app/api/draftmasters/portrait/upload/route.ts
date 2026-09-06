import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { storagePut } from "@/lib/storage";
import { recordPortraitFeedback } from "@/lib/draftmasters/db";
import { forget, nameKeys, normalizeName } from "@/lib/draftmasters/portrait-memo";

/**
 * POST /api/draftmasters/portrait/upload
 *   { imgQuery, name, dataUrl }
 *
 * Someone tapped a lettered card and picked a photo themselves. This is the
 * final rung of the portrait ladder: when Google, Fandom, Wikipedia, Commons
 * and generation have all failed, a human just hands us the right picture.
 *
 * Stored in R2 and saved as a curated portrait keyed by character name, so it
 * wins on every board that character appears on from then on.
 */

export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // generous for a phone photo, small enough to resize fast
const ALLOWED = /^image\/(jpeg|png|webp|gif)$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    imgQuery?: string;
    name?: string;
    dataUrl?: string;
    userId?: string;
  } | null;

  const imgQuery = String(body?.imgQuery ?? "").trim().slice(0, 200);
  const name = String(body?.name ?? "").trim().slice(0, 120);
  const dataUrl = String(body?.dataUrl ?? "");
  if (!name || !dataUrl.startsWith("data:")) {
    return NextResponse.json({ error: "name and image required" }, { status: 400 });
  }

  // [\s\S] rather than the /s flag — the build targets ES2017.
  const match = dataUrl.match(/^data:([^;,]+)[^,]*,([\s\S]*)$/);
  if (!match || !ALLOWED.test(match[1])) {
    return NextResponse.json({ error: "that file type isn't supported" }, { status: 415 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    return NextResponse.json({ error: "couldn't read that image" }, { status: 400 });
  }
  if (!buffer.length) return NextResponse.json({ error: "empty image" }, { status: 400 });
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "that image is too big — 8MB max" }, { status: 413 });
  }

  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? String(body?.userId ?? "anon").slice(0, 64);

  // Card-sized WebP, same treatment the bulk importer gives its files.
  let out = buffer;
  let contentType = match[1];
  try {
    const sharp = (await import("sharp")).default;
    out = await sharp(buffer)
      .rotate()
      .resize(900, 1125, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();
    contentType = "image/webp";
  } catch {
    /* no sharp — store the original rather than failing the upload */
  }

  const slug = normalizeName(name).replace(/\s+/g, "-") || "portrait";
  const path = `draftmasters/portraits/uploads/${slug}-${Date.now().toString(36)}.${
    contentType === "image/webp" ? "webp" : "img"
  }`;

  try {
    const { url } = await storagePut(path, out, { contentType });

    // Save under every key for this character, exactly like a 👍.
    await recordPortraitFeedback({
      imgQuery: imgQuery || `name:${normalizeName(name)}`,
      url,
      source: "curated",
      verdict: "good",
      userId,
      alsoKeys: nameKeys(name),
    });
    if (imgQuery) forget(imgQuery);

    return NextResponse.json({ url, source: "curated" });
  } catch (err) {
    console.error("[draftmasters/portrait/upload]", err);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
