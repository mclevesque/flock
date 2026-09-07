import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * POST /.netlify/functions/portrait-store   { name, dataUrl }  ->  { url }
 *
 * Writes one portrait to R2. That is all it does.
 *
 * It lives outside the Next app because Turbopack cannot ship the AWS SDK by
 * any route tried: a static import kills the function at load even with
 * runtime="nodejs" and serverExternalPackages set, and a dynamic import is
 * rewritten to a hashed specifier that does not resolve. Netlify bundles this
 * directory with its own esbuild, where the SDK is simply a normal dependency.
 *
 * Deliberately narrow — no auth, no database, no image processing. The caller
 * records the curated portrait afterwards through the existing feedback route.
 * Keeping the workaround to the smallest possible surface means the rest of
 * the app never has to know about it.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = /^image\/(jpeg|png|webp|gif)$/;

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
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

/** Lowercase, punctuation stripped — matches how portrait-memo keys characters. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "portrait"
  );
}

export const handler = async (event: { httpMethod: string; body: string | null }) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  let body: { name?: string; dataUrl?: string };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "bad JSON" });
  }

  const name = String(body.name ?? "").trim().slice(0, 120);
  const dataUrl = String(body.dataUrl ?? "");
  if (!name || !dataUrl.startsWith("data:")) {
    return json(400, { error: "name and image required" });
  }

  const match = dataUrl.match(/^data:([^;,]+)[^,]*,([\s\S]*)$/);
  if (!match || !ALLOWED.test(match[1])) {
    return json(415, { error: "that file type isn't supported" });
  }

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) return json(400, { error: "empty image" });
  if (buffer.length > MAX_BYTES) return json(413, { error: "that image is too big — 8MB max" });

  const contentType = match[1];
  const ext = contentType === "image/webp" ? "webp" : contentType === "image/png" ? "png" : "jpg";
  const path = `draftmasters/portraits/uploads/${slugify(name)}-${Date.now().toString(36)}.${ext}`;

  try {
    await r2().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: path,
        Body: buffer,
        ContentType: contentType,
      })
    );
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[portrait-store] R2 write failed", err);
    return json(500, { error: "couldn't store the image", detail: detail.slice(0, 200) });
  }

  return json(200, { url: `${process.env.R2_PUBLIC_URL}/${path}` });
};
