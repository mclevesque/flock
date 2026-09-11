import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * POST /.netlify/functions/avatar-store   { token, dataUrl }  ->  { url }
 *
 * Writes one profile photo to R2. The avatar twin of portrait-store, and it
 * exists for the same reason: Turbopack cannot ship the AWS SDK in a Next
 * route, and Netlify's own esbuild can.
 *
 * Unlike portrait-store this one checks who is asking. The token is signed by
 * /api/draftmasters/avatar with the auth secret and says which user may upload
 * and until when; the file lands under that user's prefix and nowhere else.
 * The browser has already cropped it to a small square, so the size cap is
 * tight — a 256px WebP is tens of kilobytes, and anything near the cap is not
 * what the app sends.
 */

const MAX_BYTES = 600 * 1024;
const ALLOWED = /^image\/(jpeg|png|webp)$/;

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

let client: S3Client | null = null;
function r2(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 is not configured on this site");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

/** Mirror of lib/draftmasters/avatar-token.ts — this bundle cannot import it. */
function verify(token: string): string | null {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const [uid, expRaw, mac] = token.split(".");
  const exp = Number(expRaw);
  if (!uid || !mac || !Number.isFinite(exp) || exp < Date.now()) return null;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(uid)) return null;
  const want = crypto.createHmac("sha256", secret).update(`avatar:${uid}:${exp}`).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? uid : null;
}

export const handler = async (event: { httpMethod: string; body: string | null }) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  let body: { token?: string; dataUrl?: string };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "bad JSON" });
  }

  const uid = verify(String(body.token ?? ""));
  if (!uid) return json(401, { error: "upload not authorised — try again" });

  const match = String(body.dataUrl ?? "").match(/^data:([^;,]+)[^,]*,([\s\S]*)$/);
  if (!match || !ALLOWED.test(match[1])) return json(415, { error: "that file type isn't supported" });

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) return json(400, { error: "empty image" });
  if (buffer.length > MAX_BYTES) return json(413, { error: "that image is too big" });

  const contentType = match[1];
  const ext = contentType === "image/webp" ? "webp" : contentType === "image/png" ? "png" : "jpg";
  const path = `avatars/${uid}_${Date.now()}.${ext}`;

  try {
    await r2().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: path,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (err) {
    console.error("[avatar-store] R2 write failed", err);
    return json(500, { error: "couldn't store the photo" });
  }

  return json(200, { url: `${process.env.R2_PUBLIC_URL}/${path}` });
};
