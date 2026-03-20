import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

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
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: path,
    Body: body as Buffer,
    ContentType: opts?.contentType,
  }));
  return { url: `${PUBLIC_URL}/${path}` };
}

export async function storageDel(url: string): Promise<void> {
  const key = url.replace(`${PUBLIC_URL}/`, "");
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
}

export async function storageList(prefix: string): Promise<StorageObject[]> {
  const res = await r2.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  return (res.Contents ?? []).map(obj => ({
    key: obj.Key!,
    url: `${PUBLIC_URL}/${obj.Key!}`,
    uploadedAt: obj.LastModified ?? new Date(),
  }));
}
