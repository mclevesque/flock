/**
 * Run once to pre-generate all coloring book preset images.
 * Uses your HuggingFace Pro token for fast inference.
 *
 * Usage:  HUGGINGFACE_TOKEN=hf_xxx node scripts/generate-coloring.mjs
 * Or:     set HUGGINGFACE_TOKEN=hf_xxx && node scripts/generate-coloring.mjs
 */

import { writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../public/coloring");

const TOKEN = process.env.HUGGINGFACE_TOKEN;
if (!TOKEN) { console.error("Set HUGGINGFACE_TOKEN env var first"); process.exit(1); }

const PRESETS = [
  // ── Fantasy Creatures ──────────────────────────────────────────────────────
  { label: "dragon",        prompt: "a majestic dragon breathing fire, scales and wings detail, fantasy" },
  { label: "unicorn",       prompt: "a unicorn in an enchanted forest with flowers and stars" },
  { label: "mermaid",       prompt: "a mermaid with flowing hair surrounded by sea creatures and coral" },
  { label: "phoenix",       prompt: "a phoenix rising from flames, intricate feather and fire patterns" },
  { label: "griffin",       prompt: "a griffin with eagle head and lion body, detailed feathers and fur" },
  { label: "pegasus",       prompt: "a winged horse pegasus flying through clouds, flowing mane" },
  { label: "kraken",        prompt: "a giant kraken with massive tentacles rising from the ocean waves" },
  { label: "fairy",         prompt: "a fairy sitting on a mushroom in a magical forest with flowers" },
  { label: "centaur",       prompt: "a centaur archer with bow and arrow, detailed armor and muscles" },
  { label: "medusa",        prompt: "medusa with snake hair, beautiful face, greek mythology art" },
  { label: "sphinx",        prompt: "an egyptian sphinx in the desert, detailed hieroglyphic patterns" },
  { label: "hydra",         prompt: "a multi-headed hydra serpent rising from water, scales detailed" },

  // ── Animals & Wildlife ─────────────────────────────────────────────────────
  { label: "wolf-moon",     prompt: "a wolf howling at a full moon with celtic knotwork patterns" },
  { label: "owl",           prompt: "an owl with galaxy and constellation patterns in its wings" },
  { label: "koi",           prompt: "koi fish swimming in a pond with lotus flowers and rippling waves" },
  { label: "tiger",         prompt: "a tiger in tall grass, detailed stripe patterns and fierce expression" },
  { label: "elephant",      prompt: "an elephant decorated with indian mandala patterns and flowers" },
  { label: "butterfly",     prompt: "a butterfly with intricate wing patterns, flowers and vines" },
  { label: "hummingbird",   prompt: "a hummingbird hovering near tropical flowers, detailed feathers" },
  { label: "seahorse",      prompt: "a seahorse with elaborate fin patterns among coral and seaweed" },
  { label: "peacock",       prompt: "a peacock with fully spread tail feathers, intricate eye patterns" },
  { label: "fox",           prompt: "a fox in an autumn forest with falling leaves, flowing tail" },
  { label: "bear",          prompt: "a bear with forest and mountain scenes within its silhouette" },
  { label: "whale",         prompt: "a whale breaching with ocean waves and geometric patterns" },

  // ── Architecture & Places ──────────────────────────────────────────────────
  { label: "castle",        prompt: "a gothic fantasy castle with towers, bridges, and stained glass" },
  { label: "lighthouse",    prompt: "a lighthouse on rocky cliffs during a storm, detailed waves" },
  { label: "cathedral",     prompt: "the interior of a gothic cathedral with ornate arches and windows" },
  { label: "treehouse",     prompt: "an elaborate treehouse village in a giant ancient tree, bridges" },
  { label: "pagoda",        prompt: "a japanese pagoda surrounded by cherry blossoms and koi pond" },
  { label: "ruins",         prompt: "ancient stone ruins overgrown with vines, mysterious atmosphere" },

  // ── Cultural & Mythological ────────────────────────────────────────────────
  { label: "samurai",       prompt: "a samurai warrior with cherry blossoms, detailed armor and katana" },
  { label: "wizard",        prompt: "an ancient wizard with staff, flowing robes and mystical symbols" },
  { label: "viking",        prompt: "a viking warrior with axe and shield, norse rune patterns" },
  { label: "aztec",         prompt: "aztec sun calendar with serpent border, detailed geometric patterns" },
  { label: "celtic",        prompt: "celtic knotwork with intertwined animals and spirals, illuminated manuscript" },
  { label: "geisha",        prompt: "a japanese geisha with elaborate kimono, fan, and cherry blossoms" },
  { label: "pharaoh",       prompt: "an egyptian pharaoh with headdress, hieroglyphics border, golden throne" },

  // ── Nature & Botanical ─────────────────────────────────────────────────────
  { label: "mandala",       prompt: "an intricate floral mandala with petals, vines and geometric patterns" },
  { label: "geometric",     prompt: "sacred geometry mandala, overlapping circles and triangles, detailed" },
  { label: "roses",         prompt: "a bouquet of roses with thorns and leaves, detailed petals" },
  { label: "mushrooms",     prompt: "a fairy ring of mushrooms with hidden gnomes and forest creatures" },
  { label: "underwater",    prompt: "an underwater coral reef scene with tropical fish, jellyfish and anemones" },
  { label: "autumn",        prompt: "a path through an autumn forest, fallen leaves, gnarled trees" },
  { label: "succulent",     prompt: "an arrangement of succulent plants in geometric pots, detailed" },
  { label: "lotus",         prompt: "a blooming lotus flower on water with ripples and lily pads" },

  // ── Space & Cosmic ─────────────────────────────────────────────────────────
  { label: "galaxy",        prompt: "a swirling galaxy with nebula clouds, stars and cosmic patterns" },
  { label: "astronaut",     prompt: "an astronaut floating in space with planets and stars around" },
  { label: "dragon-space",  prompt: "a dragon flying through outer space, stars and nebulae in wings" },
  { label: "moon-fairy",    prompt: "a fairy riding a crescent moon surrounded by stars and clouds" },
  { label: "solar-system",  prompt: "the solar system with detailed planets, rings and orbital paths" },

  // ── Seasonal & Holiday ─────────────────────────────────────────────────────
  { label: "christmas",     prompt: "a christmas village in snow with decorated trees and a cozy cottage" },
  { label: "halloween",     prompt: "a haunted house with witches, pumpkins, bats and a full moon" },
  { label: "spring",        prompt: "spring meadow with wildflowers, butterflies and baby animals" },
  { label: "winter",        prompt: "a winter landscape with snowflakes, pine trees and a frozen lake" },
];

const STYLE_SUFFIX = ", adult coloring book illustration, intricate black and white line art, thick bold outlines, white background, no shading no color no fill, highly detailed complex patterns, clean linework, professional illustration";
const NEG = "color, shading, gray, watercolor, painting, photo, realistic, blurry, low quality, text, watermark, signature";

async function generate(preset) {
  const outPath = join(OUT_DIR, `${preset.label}.png`);
  if (existsSync(outPath)) {
    console.log(`⏭  ${preset.label} already exists, skipping`);
    return;
  }

  console.log(`🎨 Generating ${preset.label}...`);
  try {
    const res = await fetch(
      "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({
          inputs: preset.prompt + STYLE_SUFFIX,
          parameters: { width: 768, height: 768, negative_prompt: NEG, num_inference_steps: 25, guidance_scale: 8.5 },
        }),
        signal: AbortSignal.timeout(60000),
      }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`❌ ${preset.label} failed: ${res.status} ${txt.slice(0, 120)}`);
      return;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(outPath, buf);
    console.log(`✅ ${preset.label} saved (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(`❌ ${preset.label} error: ${err}`);
  }
}

console.log(`🖼  Generating ${PRESETS.length} coloring book images...\n`);

// Generate sequentially to avoid rate limits
for (const preset of PRESETS) {
  await generate(preset);
  await new Promise(r => setTimeout(r, 1000));
}

console.log("\n✨ Done! Commit the public/coloring/ folder and deploy.");
console.log("   Images will load instantly as static files — zero API calls at runtime.");
