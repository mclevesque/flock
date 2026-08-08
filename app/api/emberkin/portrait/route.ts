import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEmberkinByOwner, setEmberkinImage, countEmberkinAiActions, addEmberkinEvent } from "@/lib/db";
import { generatePortrait } from "@/lib/emberkin-image";
import { hashSeed } from "@/lib/emberkin-engine";
import { asCreature, type EmberkinRow } from "@/lib/emberkin-state";

// FLUX.1-schnell takes 10–40s. This route is called on its own, never inline
// with a hatch, so the creature is usable long before its portrait exists.
export const maxDuration = 60;

/**
 * POST /api/emberkin/portrait
 * Generates the portrait for the caller's creature if it doesn't have one yet.
 * Idempotent: if a portrait already exists it is returned as-is.
 */
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const row = await getEmberkinByOwner(userId).catch(() => null);
  if (!row) return NextResponse.json({ error: "You have no emberkin." }, { status: 404 });
  if (row.stage === "egg") return NextResponse.json({ imageUrl: null, pending: false });

  // Already drawn — never regenerate. Evolution clears image_url to re-trigger.
  if (row.image_url) return NextResponse.json({ imageUrl: row.image_url, pending: false });

  // Portraits are the most expensive thing here, so they sit under the same
  // hourly ceiling as everything else.
  const used = await countEmberkinAiActions(row.id, 60).catch(() => 0);
  if (used > 60) return NextResponse.json({ imageUrl: null, pending: false, throttled: true });

  const c = asCreature(row as EmberkinRow);
  const url = await generatePortrait(c, hashSeed(c.id, c.stage));

  if (!url) return NextResponse.json({ imageUrl: null, pending: false, failed: true });

  await setEmberkinImage(c.id, url).catch(() => {});
  await addEmberkinEvent(c.id, "portrait", `You finally get a good look at ${c.name}.`).catch(() => {});

  return NextResponse.json({ imageUrl: url, pending: false });
}
