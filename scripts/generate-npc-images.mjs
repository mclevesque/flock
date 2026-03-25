/**
 * VIBE ENGINE — Step 1: NPC Image Generation
 * Generates portrait images for each Flock NPC using HuggingFace Inference API (free tier).
 * Run: node scripts/generate-npc-images.mjs
 * Output: public/images/npcs/{npcId}.png
 *
 * These images feed into vibe-engine-blender.py as texture references for 3D model generation.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../public/images/npcs");
const MODELS_DIR = path.join(__dirname, "../public/models/moonhaven");

// Load .env.local
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
  });
}

const HF_KEY = process.env.HUGGINGFACE_API_KEY;
if (!HF_KEY) {
  console.error("Missing HUGGINGFACE_API_KEY in .env.local");
  console.error("Get a free key at https://huggingface.co/settings/tokens");
  process.exit(1);
}

// HuggingFace model — FLUX.1-schnell (fast, high quality, free tier)
const HF_MODEL = "black-forest-labs/FLUX.1-schnell";

// NPC portrait prompts — each tailored to character personality + Moonhaven fantasy aesthetic
const NPC_PROMPTS = {
  elder_mira: {
    prompt: "fantasy RPG portrait, wise elderly woman, silver hair with mystical blue streaks, deep knowing eyes, ornate robes with celestial patterns, moonlit village background, soft magical aura, painterly style, detailed face, warm candlelight",
    negative: "modern, ugly, deformed, blurry, low quality",
  },
  blacksmith_theron: {
    prompt: "fantasy RPG portrait, rugged male blacksmith, mid-40s, soot-covered face, strong jaw, leather apron, muscular arms, glowing forge in background, warm orange firelight, short dark beard, honest eyes, detailed textures",
    negative: "modern, ugly, deformed, blurry, low quality",
  },
  innkeeper_bessie: {
    prompt: "fantasy RPG portrait, cheerful plump innkeeper woman, rosy cheeks, brown curly hair with flowers, friendly smile, white apron over dress, cozy tavern background, warm candlelight, welcoming expression, detailed face",
    negative: "modern, ugly, deformed, blurry, low quality",
  },
  guard_captain_aldric: {
    prompt: "fantasy RPG portrait, stern male guard captain, mid-40s, silver plate armor, short silver hair, sharp blue eyes, castle gate background, authoritative expression, battle scars, detailed metalwork armor, dusk lighting",
    negative: "modern, ugly, deformed, blurry, low quality",
  },
  court_wizard_lysara: {
    prompt: "fantasy RPG portrait, eccentric female wizard, 30s, wild auburn hair floating with static electricity, bright curious eyes, star-patterned robes, magical glowing crystals nearby, tower library background, excited expression, arcane symbols",
    negative: "modern, ugly, deformed, blurry, low quality",
  },
  queen_aelindra: {
    prompt: "fantasy RPG portrait, regal queen, golden crown with moonstone, silver-white hair, piercing silver eyes, elegant white and gold robes, throne room background, commanding yet kind expression, detailed crown jewels, moonlight through window",
    negative: "modern, ugly, deformed, blurry, low quality",
  },
  village_kid_pip: {
    prompt: "fantasy RPG portrait, energetic young boy 10 years old, messy brown hair, bright excited eyes, simple peasant clothes, tiny wooden sword, town square background, huge enthusiastic smile, freckles, golden afternoon light",
    negative: "modern, ugly, deformed, blurry, low quality, teen, adult",
  },
  town_herald: {
    prompt: "fantasy RPG portrait, dramatic male town crier, elaborate red and gold uniform, tall feathered hat, prominent cheekbones, mid-30s, town square background, holding scroll, theatrical expression, bright daylight, confident pose",
    negative: "modern, ugly, deformed, blurry, low quality",
  },
  bandit_cutpurse: {
    prompt: "fantasy RPG portrait, sneaky male bandit, lean face with sharp eyes, brown leather hood, stubble, dark forest background, suspicious smirk, dagger hilt visible, night lighting, gritty style",
    negative: "modern, ugly, deformed, blurry, low quality",
  },
  bandit_shadowblade: {
    prompt: "fantasy RPG portrait, dangerous female bandit assassin, sleek dark hair, cold calculating eyes, black leather armor, dark forest background, moonlight, menacing expression, twin daggers, mysterious shadows",
    negative: "modern, ugly, deformed, blurry, low quality",
  },
  bandit_ironclub: {
    prompt: "fantasy RPG portrait, massive brutish male bandit, bald head, heavy scarred face, enormous iron club resting on shoulder, rusted armor patches, intimidating scowl, night forest background, torchlight from below",
    negative: "modern, ugly, deformed, blurry, low quality",
  },
};

// Moonhaven world also needs some new characters
const MOONHAVEN_NPC_PROMPTS = {
  moonhaven_oracle: {
    prompt: "fantasy RPG portrait, ethereal oracle woman, silver skin with faint star patterns, white glowing eyes, flowing cosmic robes, moon temple background, otherworldly beauty, floats above ground, mystical blue light",
    negative: "modern, ugly, deformed, blurry, low quality",
  },
  moonhaven_keeper: {
    prompt: "fantasy RPG portrait, ancient male moon keeper, very old with starlight in beard, ceremonial lunar robes, gentle smile, moonhaven plaza background, keeper of celestial secrets, warm silver glow",
    negative: "modern, ugly, deformed, blurry, low quality",
  },
};

const ALL_PROMPTS = { ...NPC_PROMPTS, ...MOONHAVEN_NPC_PROMPTS };

async function generateImage(npcId, promptData, retries = 3) {
  const outPath = path.join(OUT_DIR, `${npcId}.png`);
  if (fs.existsSync(outPath)) {
    console.log(`  SKIP: ${npcId}.png (already exists)`);
    return true;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`  GEN: ${npcId} (attempt ${attempt})...`);
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${HF_MODEL}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: promptData.prompt,
            parameters: {
              negative_prompt: promptData.negative,
              width: 512,
              height: 512,
              num_inference_steps: 4, // FLUX.1-schnell uses very few steps
              guidance_scale: 0,      // schnell doesn't use CFG
            },
          }),
        }
      );

      if (res.status === 503) {
        // Model loading — wait and retry
        const json = await res.json().catch(() => ({}));
        const waitMs = (json.estimated_time ?? 20) * 1000;
        console.log(`  LOADING model, waiting ${Math.ceil(waitMs / 1000)}s...`);
        await new Promise(r => setTimeout(r, Math.min(waitMs, 30000)));
        continue;
      }

      if (!res.ok) {
        const err = await res.text();
        console.error(`  FAIL ${npcId}: HTTP ${res.status} — ${err.slice(0, 200)}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        return false;
      }

      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(outPath, buf);
      console.log(`  OK: ${npcId}.png (${(buf.length / 1024).toFixed(0)}KB)`);
      return true;
    } catch (err) {
      console.error(`  ERROR ${npcId}: ${err.message}`);
      if (attempt < retries) await new Promise(r => setTimeout(r, 3000));
    }
  }
  return false;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(MODELS_DIR, { recursive: true });

  console.log(`\n🌙 MOONHAVEN VIBE ENGINE — NPC Image Generation`);
  console.log(`Model: ${HF_MODEL}`);
  console.log(`Output: ${OUT_DIR}\n`);

  const entries = Object.entries(ALL_PROMPTS);
  let ok = 0, fail = 0;

  for (const [npcId, promptData] of entries) {
    const success = await generateImage(npcId, promptData);
    if (success) ok++; else fail++;
    // Rate limit: 500ms between calls on free tier
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Done: ${ok} generated, ${fail} failed`);
  console.log(`\nNext step: run scripts/vibe-engine-blender.py inside Blender to create 3D models`);
  console.log(`  blender --background --python scripts/vibe-engine-blender.py`);
}

main().catch(console.error);
