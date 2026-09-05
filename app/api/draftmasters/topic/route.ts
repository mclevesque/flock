import { NextResponse } from "next/server";
import { getPack, type Entry, type Pack } from "@/lib/draftmasters/packs";

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
  return NextResponse.json(
    { pack },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } }
  );
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
  const topic = (body?.topic ?? "").trim().slice(0, 120);
  if (!topic) return NextResponse.json({ error: "topic required" }, { status: 400 });

  const count = Math.max(16, Math.min(32, body?.count ?? 26));
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Topic generation is unavailable right now." }, { status: 503 });
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 3600,
        temperature: 0.85,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: `Build a draft board of exactly ${count} entries for this topic:\n\n"${topic}"\n\nRemember: every single entry must satisfy the topic AS WORDED, including any qualifier in it.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(40000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Could not build that board. Try rewording it." }, { status: 502 });
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return NextResponse.json({ error: "Empty response" }, { status: 502 });

    const pack = sanitize(JSON.parse(raw), topic);
    if (!pack || pack.entries.length < 10) {
      return NextResponse.json(
        { error: "That topic came back too thin. Try something with more names in it." },
        { status: 422 }
      );
    }
    return NextResponse.json({ pack });
  } catch {
    return NextResponse.json({ error: "Topic generation timed out. Try again." }, { status: 504 });
  }
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
Give roughly a third of entries a "variants" array: the same subject in different conditions, each with its own tier. This is the signature of the game. Examples:
- Jaime Lannister -> [{"v":"two hands","t":5},{"v":"one hand","t":3},{"v":"gold hand, drunk","t":2}]
- Charizard -> [{"v":"Mega Charizard X","t":5},{"v":"standard","t":4},{"v":"still a level 5 Charmander","t":1}]
- Dracula -> [{"v":"at night","t":5},{"v":"at high noon","t":1}]
Variants must be short (under 6 words), concrete, and genuinely change how good the subject is. One variant is rolled at random when the lot comes up. Only add variants where a real condition exists — don't invent nonsense.

OUTPUT — JSON only, this exact shape:
{
  "name": string (short board title, max 4 words),
  "emoji": string (one emoji),
  "blurb": string (one playful sentence, max 12 words),
  "imgContext": string (2-4 words appended to each name for an image search, e.g. "Game of Thrones character", "NBA player", "animal", "anime character"),
  "wiki": string (OPTIONAL but IMPORTANT for fictional topics — the Fandom wiki subdomain where these characters have pages, lowercase, no ".fandom.com". Examples: "gameofthrones", "marvel", "dc", "starwars", "pokemon", "villains" (horror/villain topics), "deathbattle" (anime/versus topics), "harrypotter", "lotr", "zelda", "residentevil", "onepiece", "naruto". Wikipedia has NO usable image for fictional characters, so getting this right is the difference between real character art and a blank card. OMIT it entirely for real-world topics — real people, animals, places, food, history, sports — where Wikipedia is better.),
  "scenario": string (1-2 sentences: the situation both drafted rosters are thrown into — make it concrete and specific to this topic),
  "criteria": string (1 sentence: what actually decides the winner in that scenario),
  "entries": [
    { "n": string (the name, no parentheses in it),
      "t": number 1-5 (base tier),
      "s": string (OPTIONAL, extra words to disambiguate an image search — use for common names, e.g. "Gulo gulo animal"),
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

    if (Array.isArray(item.variants)) {
      const variants = (item.variants as Record<string, unknown>[])
        .map((v) => ({
          v: String(v?.v ?? "").trim().replace(/^\(|\)$/g, "").slice(0, 40),
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

  const title = String(raw.name ?? topic).trim().slice(0, 40) || topic;
  // Subdomain only — anything else is a malformed guess and gets dropped.
  const rawWiki = String(raw.wiki ?? "").trim().toLowerCase().replace(/\.fandom\.com.*$/, "");
  const wiki = /^[a-z0-9-]{2,40}$/.test(rawWiki) ? rawWiki : undefined;

  return {
    ...(wiki ? { wiki } : {}),
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
