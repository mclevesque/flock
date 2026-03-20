/**
 * Storage abstraction — currently wraps @vercel/blob.
 * To migrate to Cloudflare R2, replace the put/del implementations below
 * with @aws-sdk/client-s3 calls and update the env vars in .env.
 *
 * R2 swap checklist:
 * 1. npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
 * 2. Set in .env:
 *    R2_ACCOUNT_ID=your_account_id
 *    R2_ACCESS_KEY_ID=your_access_key_id
 *    R2_SECRET_ACCESS_KEY=your_secret_access_key
 *    R2_BUCKET=flock
 *    R2_PUBLIC_URL=https://pub-xxxx.r2.dev   (or custom domain)
 * 3. Uncomment the R2 block below and comment out the vercel/blob block.
 */

import { put as vercelPut, del as vercelDel } from "@vercel/blob";

export interface StorageResult {
  url: string;
}

// ── Vercel Blob (current) ─────────────────────────────────────────────────────
export async function storagePut(
  path: string,
  data: Blob | Buffer | ArrayBuffer | ReadableStream | string,
  opts?: { contentType?: string }
): Promise<StorageResult> {
  const blob = await vercelPut(path, data as Parameters<typeof vercelPut>[1], {
    access: "public",
    contentType: opts?.contentType,
  });
  return { url: blob.url };
}

export async function storageDel(url: string): Promise<void> {
  await vercelDel(url).catch(() => {});
}

// ── Cloudflare R2 (uncomment when ready) ──────────────────────────────────────
// import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
//
// const r2 = new S3Client({
//   region: "auto",
//   endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
//   credentials: {
//     accessKeyId: process.env.R2_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
//   },
// });
// const BUCKET = process.env.R2_BUCKET!;
// const PUBLIC_URL = process.env.R2_PUBLIC_URL!;
//
// export async function storagePut(
//   path: string,
//   data: Blob | Buffer | ArrayBuffer | ReadableStream | string,
//   opts?: { contentType?: string }
// ): Promise<StorageResult> {
//   const body = data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : data;
//   await r2.send(new PutObjectCommand({
//     Bucket: BUCKET, Key: path, Body: body as Buffer,
//     ContentType: opts?.contentType, ACL: "public-read",
//   }));
//   return { url: `${PUBLIC_URL}/${path}` };
// }
//
// export async function storageDel(url: string): Promise<void> {
//   const key = url.replace(`${PUBLIC_URL}/`, "");
//   await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
// }
