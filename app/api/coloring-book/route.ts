/**
 * AI Coloring Book Generation — HuggingFace Inference API (free tier)
 * Returns a base64 data URL of a line-art coloring page.
 * Uses stabilityai/stable-diffusion-xl-base-1.0 (faster cold start than SD 2.1)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

  const hfKey = process.env.HUGGINGFACE_TOKEN ?? process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) {
    return NextResponse.json({ error: "HUGGINGFACE_TOKEN not set" }, { status: 503 });
  }

  // Coloring book style prompt engineering for clean line art
  const coloringPrompt = [
    prompt.trim(),
    "adult coloring book illustration",
    "intricate black and white line art",
    "thick bold outlines",
    "white background",
    "no shading no color no fill",
    "highly detailed complex patterns",
    "clean linework",
    "professional illustration",
  ].join(", ");

  const negativePrompt = "color, shading, gray, watercolor, painting, photo, realistic, blurry, low quality, text, watermark";

  // Try SDXL first (better quality), fall back to SD 2.1 — both via Pro router
  const models = [
    "stabilityai/stable-diffusion-xl-base-1.0",
    "stabilityai/stable-diffusion-2-1",
  ];

  let lastError = "";
  for (const model of models) {
    try {
      const hfRes = await fetch(
        `https://router.huggingface.co/hf-inference/models/${model}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${hfKey}`,
          },
          body: JSON.stringify({
            inputs: coloringPrompt,
            parameters: {
              width: 768,
              height: 768,
              negative_prompt: negativePrompt,
              num_inference_steps: 25,
              guidance_scale: 8.5,
            },
          }),
          signal: AbortSignal.timeout(55000),
        }
      );

      if (!hfRes.ok) {
        const text = await hfRes.text().catch(() => "");
        console.error(`HuggingFace ${model} error:`, hfRes.status, text);
        lastError = `Model ${model} returned ${hfRes.status}`;
        continue;
      }

      // Verify it returned an image (not a JSON error)
      const contentType = hfRes.headers.get("content-type") ?? "";
      if (!contentType.includes("image")) {
        const text = await hfRes.text().catch(() => "");
        console.error(`HuggingFace ${model} returned non-image:`, text.slice(0, 200));
        lastError = text.slice(0, 100);
        continue;
      }

      const imageBuffer = await hfRes.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString("base64");
      return NextResponse.json({ dataUrl: `data:image/png;base64,${base64}` });

    } catch (err) {
      console.error(`HuggingFace ${model} fetch error:`, err);
      lastError = String(err);
      continue;
    }
  }

  return NextResponse.json(
    { error: `Generation failed — ${lastError || "model may be loading, try again in 30s"}` },
    { status: 502 }
  );
}
