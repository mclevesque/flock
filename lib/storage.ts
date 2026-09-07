/**
 * Required lazily, and Turbopack cannot ship this SDK either way.
 *
 * Measured, both forms fail in production: a static import kills the function
 * at load even with runtime="nodejs" and serverExternalPackages declared, and
 * this dynamic form is rewritten to "@aws-sdk/client-s3-<hash>", which does not
 * exist. So EVERY R2 write from a Next route is currently broken — avatars and
 * audio included, not just portraits.
 *
 * The dynamic form is kept because it fails at CALL time rather than load
 * time: the route stays up and returns real JSON, so one broken feature does
 * not take a whole function down with it.
 *
 * Portrait writes therefore go through netlify/functions/portrait-store, which
 * Netlify bundles with its own esbuild and which resolves the SDK correctly.
 */
import type { S3Client } from "@aws-sdk/client-s3";

/**
 * Built on first use, not at import.
 *
 * Constructing the client at module scope means a missing R2 variable throws
 * while the module is still loading — which takes the whole serverless
 * function down before any route code runs. The caller's try/catch never sees
 * it, the route's own validation never runs, and the platform answers with a
 * plain-text "Internal Server Error" that the browser then fails to parse as
 * JSON. One absent env var reads as "photo upload is broken" with nothing
 * anywhere to say why.
 *
 * Deferring it turns that into an ordinary caught error at the call site.
 */
let _r2: S3Client | null = null;

async function client(): Promise<S3Client> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 storage is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY"
    );
  }
  if (!_r2) {
    const { S3Client: Ctor } = await import("@aws-sdk/client-s3");
    _r2 = new Ctor({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return _r2;
}

const BUCKET = process.env.R2_BUCKET ?? "";
const PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "";

export interface StorageResult {
  url: string;
}

export interface StorageObject {
  key: string;
  url: string;
  uploadedAt: Date;
}

export async function storagePut(
  path: string,
  data: Blob | Buffer | ArrayBuffer | ReadableStream | string,
  opts?: { contentType?: string }
): Promise<StorageResult> {
  const body =
    data instanceof Blob ? Buffer.from(await data.arrayBuffer()) :
    data instanceof ArrayBuffer ? Buffer.from(data) :
    data;
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await (await client()).send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: path,
    Body: body as Buffer,
    ContentType: opts?.contentType,
  }));
  return { url: `${PUBLIC_URL}/${path}` };
}

export async function storageDel(url: string): Promise<void> {
  const key = url.replace(`${PUBLIC_URL}/`, "");
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await (await client()).send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
}

/**
 * Generate a short-lived presigned URL for private R2 objects (e.g. stories/).
 * The object is NOT publicly accessible — only this URL works, and only for `expiresIn` seconds.
 * This means even we cannot casually browse story content — URLs expire quickly.
 */
export async function storagePresign(path: string, expiresIn = 3600): Promise<string> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: path });
  return getSignedUrl(await client(), cmd, { expiresIn });
}

export async function storageList(prefix: string): Promise<StorageObject[]> {
  const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const res = await (await client()).send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  return (res.Contents ?? []).map(obj => ({
    key: obj.Key!,
    url: `${PUBLIC_URL}/${obj.Key!}`,
    uploadedAt: obj.LastModified ?? new Date(),
  }));
}
