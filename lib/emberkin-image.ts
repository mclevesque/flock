/**
 * Emberkin — creature portraits.
 *
 * Two free providers, tried in order, mirroring the fallback chain already in
 * app/api/generate-image/route.ts:
 *
 *   1. HuggingFace FLUX.1-schnell — better output, needs HUGGINGFACE_TOKEN.
 *      HF's free allowance for hosted inference has tightened over time, so
 *      this may start returning 402/429 on a free account.
 *   2. Pollinations — no key, no account, no quota to run out of. Lower
 *      fidelity, but it means portraits keep working regardless of HF.
 *
 * Whichever succeeds gets uploaded to R2, so we generate once per form rather
 * than on every page load.
 *
 * Generation takes 10–40s, far too long to block a hatch on. So this is never
 * called inline: the creature hatches immediately with its emoji sprite, and the
 * client asks for the portrait separately. If BOTH providers fail this returns
 * null and the emoji stays — a creature without a portrait is a fully working
 * creature.
 */

import { storagePut } from "./storage";
import type { Creature } from "./emberkin-engine";

const FLUX_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";

/** Rarity nudges the framing so a mythic doesn't look like a common. */
const RARITY_STYLE: Record<string, string> = {
  common: "humble, small, endearing",
  uncommon: "distinctive, one strange feature",
  rare: "striking, unusual silhouette",
  mythic: "awe-inspiring, mythic presence, subtle golden light",
  aberrant: "unsettling, wrong proportions, quietly disturbing",
};

const STAGE_STYLE: Record<string, string> = {
  hatchling: "tiny newborn creature, oversized head, unsteady",
  juvenile: "half-grown creature, gangly, growing into itself",
  adult: "fully grown creature, confident, settled in its body",
  ascended: "transcendent final form, imposing, otherworldly",
};

export function portraitPrompt(c: Creature): string {
  return [
    `A single fantasy creature: ${c.species}.`,
    c.appearance,
    `${STAGE_STYLE[c.stage] ?? ""}. ${RARITY_STYLE[c.rarity] ?? ""}. ${c.temperament} demeanour.`,
    `Made of ${c.element}.`,
    "Dark fantasy creature concept art, painterly, dramatic warm firelight from below,",
    "deep shadows, muted earthy palette with ember-gold highlights, dark background,",
    "full body, centred, single subject, no text, no watermark, no humans.",
  ].filter(Boolean).join(" ").slice(0, 900);
}

interface RawImage { bytes: ArrayBuffer; contentType: string }

/** HuggingFace FLUX.1-schnell. Needs a token; may be quota-limited on free accounts. */
async function tryHuggingFace(prompt: string, seed: number): Promise<RawImage | null> {
  const token = process.env.HUGGINGFACE_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(FLUX_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: prompt, parameters: { seed } }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;

    const bytes = await res.arrayBuffer();
    // HF returns a small JSON error body (model loading, quota) with a 200.
    if (bytes.byteLength < 2000) return null;

    return { bytes, contentType: res.headers.get("content-type") ?? "image/jpeg" };
  } catch {
    return null;
  }
}

/** Pollinations — keyless and free. The safety net when HF is unavailable. */
async function tryPollinations(prompt: string, seed: number): Promise<RawImage | null> {
  try {
    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?seed=${seed}&width=768&height=768&nologo=true`;

    const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
    if (!res.ok) return null;

    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < 2000) return null;

    return { bytes, contentType: res.headers.get("content-type") ?? "image/jpeg" };
  } catch {
    return null;
  }
}

/**
 * Generates a portrait and stores it in R2. Returns the public URL, or null if
 * every provider failed — callers must treat null as "keep using the emoji".
 */
export async function generatePortrait(c: Creature, seed: number): Promise<string | null> {
  const prompt = portraitPrompt(c);
  const s = Math.abs(seed) % 100000;

  const image = (await tryHuggingFace(prompt, s)) ?? (await tryPollinations(prompt, s));
  if (!image) return null;

  try {
    const ext = image.contentType.includes("png") ? "png" : "jpg";
    // Stage in the key so an evolved form doesn't overwrite the old portrait.
    const key = `emberkin/${c.id}-${c.stage}-${Date.now().toString(36)}.${ext}`;
    const { url } = await storagePut(key, image.bytes, { contentType: image.contentType });
    return url;
  } catch {
    return null;
  }
}
