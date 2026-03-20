import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const maxDuration = 60; // seconds — HuggingFace FLUX takes 10–40s

// POST /api/generate-image
// Generates with HuggingFace FLUX and streams image bytes directly back.
// Does NOT save to Vercel Blob — that happens only when the user clicks "Use This"
// via POST /api/avatar-upload. This way we only store confirmed selections.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.HUGGINGFACE_TOKEN;
  if (!token) return NextResponse.json({ error: "HUGGINGFACE_TOKEN not set" }, { status: 503 });

  const { prompt, seed } = await req.json();
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const finalSeed = seed ?? Math.floor(Math.random() * 99999);

  const hfRes = await fetch(
    "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt, parameters: { seed: finalSeed } }),
    }
  );

  if (!hfRes.ok) {
    const err = await hfRes.text().catch(() => hfRes.status.toString());
    return NextResponse.json({ error: `HuggingFace error: ${err}` }, { status: 502 });
  }

  // Stream image bytes directly — client creates a blob URL for preview.
  // Only saved to Vercel Blob if user confirms via /api/avatar-upload.
  return new Response(hfRes.body, {
    headers: {
      "Content-Type": hfRes.headers.get("content-type") ?? "image/jpeg",
      "X-Seed": String(finalSeed),
      "Cache-Control": "no-store",
    },
  });
}

// GET /api/generate-image — backward compat for old avatar URLs stored in DB
// Redirects to HuggingFace so existing /api/generate-image?prompt=...&seed=... links still work
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get("prompt");
  if (!prompt) return new Response("No prompt", { status: 400 });

  const token = process.env.HUGGINGFACE_TOKEN;
  const seed = parseInt(searchParams.get("seed") ?? "0") || Math.floor(Math.random() * 99999);

  if (!token) {
    // Fallback to Pollinations if no HF token
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=512&height=512&nologo=true`;
    return Response.redirect(url, 302);
  }

  // Generate synchronously and stream back (for legacy avatar display)
  try {
    const res = await fetch(
      "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: prompt, parameters: { seed } }),
      }
    );
    if (!res.ok || !res.body) return new Response("Generation failed", { status: 502 });
    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, immutable, max-age=31536000",
      },
    });
  } catch {
    return new Response("Error", { status: 504 });
  }
}
