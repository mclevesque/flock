import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkAndIncrementAiUsage } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

  const usage = await checkAndIncrementAiUsage(session.user.id, session.user.name ?? "", "music").catch(() => ({ allowed: true }));
  if (!usage.allowed) return NextResponse.json({ error: `Daily music limit reached (${(usage as {limit:number}).limit}/day). Try again tomorrow!` }, { status: 429 });

  const hfToken = process.env.HUGGINGFACE_TOKEN;
  if (!hfToken) return NextResponse.json({ error: "AI music generation not configured (HUGGINGFACE_TOKEN missing)" }, { status: 503 });

  // Use musicgen-small for speed; musicgen-stereo-small for stereo output
  const modelId = "facebook/musicgen-small";

  const hfRes = await fetch(`https://router.huggingface.co/hf-inference/models/${modelId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
      "Content-Type": "application/json",
      Accept: "audio/wav",
    },
    body: JSON.stringify({
      inputs: prompt.trim(),
      parameters: {
        max_new_tokens: 512,  // ~15s of audio
        do_sample: true,
        guidance_scale: 3,
      },
    }),
  });

  if (!hfRes.ok) {
    const txt = await hfRes.text().catch(() => "Unknown error");
    // Model loading — tell client to retry
    if (hfRes.status === 503) return NextResponse.json({ error: "Model warming up, please wait 20s and try again", loading: true }, { status: 503 });
    return NextResponse.json({ error: `Generation failed: ${txt}` }, { status: 500 });
  }

  const contentType = hfRes.headers.get("content-type") ?? "audio/wav";
  const ext = contentType.includes("flac") ? "flac" : contentType.includes("mpeg") || contentType.includes("mp3") ? "mp3" : "wav";

  const audioBuffer = await hfRes.arrayBuffer();
  const blob = await put(`ai-songs/${session.user.id}-${Date.now()}.${ext}`, audioBuffer, {
    access: "public",
    contentType,
  });

  return NextResponse.json({ url: blob.url, contentType });
}
