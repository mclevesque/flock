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

/**
 * The load-bearing line. Without it this route can be placed on the Edge
 * runtime, where the AWS SDK cannot load — the module dies during
 * initialisation and the platform answers with a plain-text "Internal Server
 * Error" before any code here runs. Every other R2 route in this app declares
 * it; this one never did, which is the whole reason photo upload was broken
 * while avatar upload beside it worked.
 */
export const runtime = "nodejs";

export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // generous for a phone photo, small enough to resize fast
const ALLOWED = /^image\/(jpeg|png|webp|gif)$/;

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  let imgQuery = "";
  let name = "";
  let bodyUserId = "";
  let buffer: Buffer;
  let sentType = "";

  if (ct.includes("multipart/form-data")) {
    // The studio's path: a card-cropped file, posted as a file. Same shape the
    // avatar route has always used, and it skips the ~33% base64 inflation
    // that pushed larger photos at the platform's request ceiling.
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    name = String(form.get("name") ?? "").trim().slice(0, 120);
    imgQuery = String(form.get("imgQuery") ?? "").trim().slice(0, 200);
    bodyUserId = String(form.get("userId") ?? "");
    sentType = file.type || "image/webp";
    if (!ALLOWED.test(sentType)) {
      return NextResponse.json({ error: "that file type isn't supported" }, { status: 415 });
    }
    buffer = Buffer.from(await file.arrayBuffer());
  } else {
    // The in-game path still posts a data URL.
    const body = (await req.json().catch(() => null)) as {
      imgQuery?: string;
      name?: string;
      dataUrl?: string;
      userId?: string;
    } | null;

    imgQuery = String(body?.imgQuery ?? "").trim().slice(0, 200);
    name = String(body?.name ?? "").trim().slice(0, 120);
    bodyUserId = String(body?.userId ?? "");
    const dataUrl = String(body?.dataUrl ?? "");
    if (!name || !dataUrl.startsWith("data:")) {
      return NextResponse.json({ error: "name and image required" }, { status: 400 });
    }

    // [\s\S] rather than the /s flag — the build targets ES2017.
    const match = dataUrl.match(/^data:([^;,]+)[^,]*,([\s\S]*)$/);
    if (!match || !ALLOWED.test(match[1])) {
      return NextResponse.json({ error: "that file type isn't supported" }, { status: 415 });
    }
    sentType = match[1];
    try {
      buffer = Buffer.from(match[2], "base64");
    } catch {
      return NextResponse.json({ error: "couldn't read that image" }, { status: 400 });
    }
  }

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!buffer.length) return NextResponse.json({ error: "empty image" }, { status: 400 });
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "that image is too big — 8MB max" }, { status: 413 });
  }

  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? (bodyUserId || "anon").slice(0, 64);

  /**
   * Stored as sent — the browser has already resized it to card size.
   *
   * This used to call sharp here. sharp is a native binary and not a declared
   * dependency (it arrives only because Next depends on it), so what resolves
   * on a dev machine is not dependably in a Linux function bundle — and a
   * dynamic import of it drags that binary into the trace. Resizing in the
   * browser removes the native module from this function altogether and keeps
   * the request small enough to survive the platform's body limit.
   */
  const out = buffer;
  const contentType = sentType;

  const slug = normalizeName(name).replace(/\s+/g, "-") || "portrait";
  const ext = contentType === "image/webp" ? "webp" : contentType === "image/png" ? "png" : "jpg";
  const path = `draftmasters/portraits/uploads/${slug}-${Date.now().toString(36)}.${ext}`;

  /**
   * Stored first, recorded second — and the two are reported separately.
   *
   * They used to share one catch that returned a flat "upload failed", which
   * is indistinguishable between "R2 rejected the write" and "the database
   * insert broke", and gives nobody debugging it anything to go on. The photo
   * is the part the player cares about: if R2 succeeded but the bookkeeping
   * failed, the upload still worked and should be reported as such.
   */
  let url: string;
  try {
    ({ url } = await storagePut(path, out, { contentType }));
  } catch (err) {
    // The detail goes to the log, never to the player. Returning it put a Node
    // require stack in the middle of a game screen, which tells them nothing
    // and looks broken.
    console.error("[draftmasters/portrait/upload] storage write failed", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return NextResponse.json(
      {
        error: "couldn't save that photo right now — try again in a moment",
        // Short, single-line, and no stack. Enough to diagnose an R2 rejection
        // without putting a require trace on a game screen again.
        detail: detail.slice(0, 200),
      },
      { status: 500 }
    );
  }

  try {
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
  } catch (err) {
    // The picture is safely stored and usable; only the "remember this for
    // next time" step failed. Losing the whole upload over that would be worse.
    console.error("[draftmasters/portrait/upload] feedback record failed", err);
    return NextResponse.json({ url, source: "curated", warning: "saved, but not remembered for next time" });
  }

  return NextResponse.json({ url, source: "curated" });
}
