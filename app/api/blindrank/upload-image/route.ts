import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(req: Request) {
  try {
    const { base64, filename } = await req.json();
    if (!base64 || !filename) {
      return Response.json({ error: "Missing base64 or filename" }, { status: 400 });
    }

    const buffer = Buffer.from(base64.split(",")[1] || base64, "base64");
    const key = `blindrank/${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`;

    const cmd = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME || "flock",
      Key: key,
      Body: buffer,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000",
    });

    await s3.send(cmd);
    const url = `https://${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
    return Response.json({ url });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
