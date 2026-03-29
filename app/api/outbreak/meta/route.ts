import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET!;

function metaKey(userId: string) {
  return `outbreak-meta/${userId}.json`;
}

// GET /api/outbreak/meta — load meta for current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: metaKey(session.user.id) }));
    const text = await res.Body?.transformToString();
    if (!text) return NextResponse.json({ meta: null });
    return NextResponse.json({ meta: JSON.parse(text) });
  } catch (e: unknown) {
    // NoSuchKey = first time player, not an error
    if ((e as { name?: string }).name === "NoSuchKey" || (e as { Code?: string }).Code === "NoSuchKey") {
      return NextResponse.json({ meta: null });
    }
    console.error("[outbreak/meta GET]", e);
    return NextResponse.json({ meta: null }); // fail-open so game still loads
  }
}

// POST /api/outbreak/meta — save meta for current user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: metaKey(session.user.id),
      Body: JSON.stringify(body),
      ContentType: "application/json",
    }));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[outbreak/meta POST]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
