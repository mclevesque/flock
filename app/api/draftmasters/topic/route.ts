import { NextResponse } from "next/server";
import { getPack, type Entry, type Pack } from "@/lib/draftmasters/packs";
import { DRAFT_MODEL } from "@/lib/draftmasters/model";

/**
 * GET /api/draftmasters/topic?packId=got
 *
 * Full board for a preset pack. The page ships only pack metadata so the
 * initial payload stays small; the entries arrive when a topic is picked,
 * on the same prep screen that generates custom boards.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const packId = searchParams.get("packId") ?? "";
  const pack = getPack(packId);
  if (!pack) return NextResponse.json({ error: "unknown pack" }, { status: 404 });
  // Kept for old clients only. The CDN ignores ?packId in its cache key, which
  // is how one board got served for every topic — so this must never be cached.
  // New clients use /api/draftmasters/pack/:packId.
  return NextResponse.json({ pack }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/draftmasters/topic  { topic: string, count?: number }
 *
 * Builds a draft board for ANY topic the player types.
 *
 * The hard part isn't listing names — it's obeying the qualifier. "Game of
 * Thrones warriors" must not return Cersei Lannister; "Game of Thrones
 * schemers" must lead with her. The prompt below spends most of its budget on
 * that single rule, then on tier spread (a board where everything is a 5 has no
 * auction in it) and on the "(two hands)" variant mechanic.
 *
 * Groq/Llama per house rules — free tier, no paid providers.
 */

export const maxDuration = 45;

interface TopicRequest {
  topic?: string;
  count?: number;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as TopicRequest | null;
  // Long enough to say what you actually mean — qualifiers, exclusions, eras.
  const topic = (body?.topic ?? "").trim().slice(0, 600);
  if (!topic) return NextResponse.json({ error: "topic required" }, { status: 400 });

  const count = Math.max(16, Math.min(32, body?.count ?? 26));
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Topic generation is unavailable right now." }, { status: 503 });
  }

  // A board this long occasionally comes back as malformed JSON, which Groq
  // rejects outright. That's a dice roll, not a bad topic — so re-roll once at
  // a lower temperature before telling the player their topic didn't work.
  const attempts: { temperature: number; count: number }[] = [
    { temperature: 0.85, count },
    { temperature: 0.5, count: Math.max(16, count - 4) },
  ];

  let lastError = "Could not build that board. Try rewording it.";

  for (const attempt of attempts) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: DRAFT_MODEL,
          max_tokens: 12000,
          // Medium, not low: the board is built once behind a loading screen,
          // and the extra think-time buys sharper qualifier filtering and
          // variants people actually quote. Worth a few more seconds.
          reasoning_effort: "medium",
          temperature: attempt.temperature,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Build a draft board of exactly ${attempt.count} entries for this topic:\n\n"${topic}"\n\nRemember: every single entry must satisfy the topic AS WORDED, including any qualifier in it.`,
            },
          ],
        }),
        signal: AbortSignal.timeout(40000),
      });

      if (!res.ok) {
        lastError = "Could not build that board. Try rewording it.";
        continue;
      }

      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content;
      if (!raw) {
        lastError = "The board came back empty. Try again.";
        continue;
      }

      const pack = sanitize(JSON.parse(raw), topic);
      if (!pack || pack.entries.length < 10) {
        lastError = "That topic came back too thin. Try something with more names in it.";
        continue;
      }
      return NextResponse.json({ pack });
    } catch {
      lastError = "Topic generation hit a snag. Try again.";
    }
  }

  return NextResponse.json({ error: lastError }, { status: 502 });
}

const SYSTEM_PROMPT = `You build draft boards for DraftMasters, a live auction draft game.

THE ONE RULE THAT MATTERS — OBEY THE QUALIFIER:
The topic is a filter, not a theme. Read it literally and exclude anything that fails it.
- "Game of Thrones warriors" -> Jaime Lannister, The Hound, Brienne YES. Cersei, Varys, Littlefinger NO — they are not warriors.
- "Game of Thrones schemers" -> Cersei, Varys, Littlefinger YES. The Mountain NO.
- "NBA point guards" -> only point guards. No centers, however famous.
- "80s horror villains" -> nothing from the 90s onward.
- "underrated sci-fi movies" -> no Star Wars, no Blade Runner; the qualifier rules those out.
If a famous name fails the qualifier, LEAVE IT OUT. A board of 20 correct entries beats 30 with four cheats in it.

THE BOARD MUST HAVE A SPREAD:
An auction is only fun when prices differ. Aim for roughly:
- 15% tier 5 (the ones people will overpay for)
- 25% tier 4
- 25% tier 3
- 20% tier 2
- 15% tier 1 (the punchlines and the traps — genuinely weak picks that still fit the topic)
Never make everything a 4 or 5. The cheap picks are the joke and the strategy.

VARIANTS — the "(two hands)" mechanic:
Give roughly a third of entries a "variants" array: the same subject in different iconic states, each with its own tier. This is the signature of the game and the part people quote to each other, so every variant must be FUNNY, COOL, or MEANINGFUL — a specific moment, form, era, piece of gear, or crossover fans would recognise:
- Jaime Lannister -> [{"v":"two hands","t":5},{"v":"one hand","t":3},{"v":"gold hand, drunk","t":2}]
- Ser Barristan Selmy -> [{"v":"prime, Barristan the Bold","t":5},{"v":"old man","t":3}]
- Pikachu -> [{"v":"Ash's Pikachu","t":4},{"v":"wild, level 3","t":1}]
- Master Chief -> [{"v":"on a dragon","t":5},{"v":"no shields","t":3}]
- Charizard -> [{"v":"Mega Charizard X","t":5},{"v":"still a level 5 Charmander","t":1}]
- Dracula -> [{"v":"at night","t":5},{"v":"at high noon","t":1}]
NEVER use a bare generic state as a variant: not "wounded", "injured", "tired", "weak", "angry", "old", "young", "damaged" on their own. If a condition matters, name the specific one ("burned leg, feverish", "post-Mustafar", "hand cut off by Vader").
TIER DELTAS MUST BE PROPORTIONATE. A mild or cosmetic condition costs AT MOST one tier — a wounded Aragorn is still Aragorn, only slightly worse. Only genuinely crippling states (missing sword hand, sealed away, dying, stripped of the thing that makes them powerful) drop two or more tiers. Upside variants (prime, mega form, with their signature weapon) can add one or two.
MIX LENGTHS. Some variants are two words ("two hands", "prime"); some are a whole vivid situation, up to about a dozen words — "with one dragon, furious after losing the other two", "Old Ben, decades in hiding, sabre still under the bed". A long one should read like a moment fans would picture instantly. One is rolled at random when the lot comes up. Only add variants where a real, recognisable state exists — don't invent nonsense.

OUTPUT — JSON only, this exact shape:
{
  "name": string (short board title, max 4 words),
  "emoji": string (one emoji),
  "blurb": string (one playful sentence, max 12 words),
  "imgContext": string (2-4 words appended to each name for an image search, e.g. "Game of Thrones character", "NBA player", "animal", "anime character"),
  "wiki": string (OPTIONAL but IMPORTANT for fictional topics — the Fandom wiki subdomain where these characters have pages, lowercase, no ".fandom.com". Examples: "gameofthrones", "marvel", "dc", "starwars", "pokemon", "villains" (horror/villain topics), "deathbattle" (anime/versus topics), "harrypotter", "lotr", "zelda", "residentevil", "onepiece", "naruto". Wikipedia has NO usable image for fictional characters, so getting this right is the difference between real character art and a blank card. OMIT it entirely for real-world topics — real people, animals, places, food, history, sports — where Wikipedia is better.),
  "scenario": string (1-2 sentences: the situation both drafted rosters are thrown into — make it concrete and specific to this topic. If the player's topic already names a setting or a contest, USE THEIRS and don't invent a different one),
  "criteria": string (1 sentence: what actually decides the winner in that scenario. Be honest about it — if the scenario rewards planning, knowledge or invention, say that intelligence and ingenuity outweigh raw strength),
  "arenas": [ { "name": string (3-5 words, e.g. "An open grass field"), "desc": string (1 sentence appended to the scenario, describing what this setting does to the contest), "weight": number } ]
    (3-5 settings this topic could be played in, ONE is rolled per game. The ordinary, expected setting gets weight 10; genuine twists that flip the board — deep water, killing cold, no sunlight, powers suppressed, a sealed room — get weight 2-4 so they show up occasionally and surprise people. Make each one actually change who wins.),
  "entries": [
    { "n": string (the name, no parentheses in it),
      "t": number 1-5 (base tier),
      "s": string (REQUIRED whenever the name could be a real person or someone from another franchise — put the franchise here: Jon Snow -> "Game of Thrones", Jin -> "Samurai Champloo", Wolverine the animal -> "Gulo gulo animal". A bare "Jon Snow" image search returns a British newsreader.),
      "wiki": string (REQUIRED on crossover/mixed boards — this entry's own Fandom subdomain, e.g. "gameofthrones", "samuraichamploo", "marvel". Omit only when the board-level wiki already covers this entry, or the entry is real-world.),
      "variants": [ {"v": string, "t": number 1-5} ]  (OPTIONAL) }
  ]
}

No duplicate names. No commentary outside the JSON.`;

// ── Sanitising ───────────────────────────────────────────────────────────────
// The model is good but not trusted — everything gets clamped and de-duped
// before it reaches the auction engine.

function sanitize(raw: Record<string, unknown>, topic: string): Pack | null {
  if (!raw || !Array.isArray(raw.entries)) return null;

  const seen = new Set<string>();
  const entries: Entry[] = [];

  for (const item of raw.entries as Record<string, unknown>[]) {
    const n = String(item?.n ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const entry: Entry = { n, t: clampTier(item.t) };

    const s = typeof item.s === "string" ? item.s.trim().slice(0, 60) : "";
    if (s) entry.s = s;

    const entryWiki = String(item.wiki ?? "").trim().toLowerCase().replace(/\.fandom\.com.*$/, "");
    if (/^[a-z0-9-]{2,40}$/.test(entryWiki)) entry.wiki = entryWiki;

    if (Array.isArray(item.variants)) {
      const variants = (item.variants as Record<string, unknown>[])
        .map((v) => ({
          v: String(v?.v ?? "").trim().replace(/^\(|\)$/g, "").slice(0, 90),
          t: clampTier(v?.t),
        }))
        .filter((v) => v.v.length > 0)
        .slice(0, 4);
      if (variants.length >= 2) entry.variants = variants;
    }

    entries.push(entry);
    if (entries.length >= 32) break;
  }

  if (entries.length < 10) return null;

  const arenas = (Array.isArray(raw.arenas) ? (raw.arenas as Record<string, unknown>[]) : [])
    .map((a) => ({
      name: String(a?.name ?? "").trim().slice(0, 60),
      desc: String(a?.desc ?? "").trim().slice(0, 220),
      weight: Math.max(1, Math.min(20, Math.round(Number(a?.weight) || 5))),
    }))
    .filter((a) => a.name && a.desc)
    .slice(0, 6);

  const title = String(raw.name ?? topic).trim().slice(0, 40) || topic;
  // Subdomain only — anything else is a malformed guess and gets dropped.
  const rawWiki = String(raw.wiki ?? "").trim().toLowerCase().replace(/\.fandom\.com.*$/, "");
  const wiki = /^[a-z0-9-]{2,40}$/.test(rawWiki) ? rawWiki : undefined;

  return {
    ...(wiki ? { wiki } : {}),
    ...(arenas.length ? { arenas } : {}),
    id: `custom:${slug(topic)}`,
    name: title,
    emoji: firstEmoji(String(raw.emoji ?? "")) ?? "🎲",
    blurb: String(raw.blurb ?? `A ${title} auction draft.`).trim().slice(0, 120),
    imgContext: String(raw.imgContext ?? "").trim().slice(0, 40),
    scenario:
      String(raw.scenario ?? "").trim().slice(0, 400) ||
      `Two drafted rosters of ${title} go head to head.`,
    criteria:
      String(raw.criteria ?? "").trim().slice(0, 300) ||
      "Overall quality of the roster against the topic, and whether the picks work together.",
    entries,
  };
}

function clampTier(t: unknown): number {
  const n = Math.round(Number(t));
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, n));
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function firstEmoji(s: string): string | null {
  const match = s.match(/\p{Extended_Pictographic}/u);
  return match ? match[0] : null;
}
