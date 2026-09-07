import { NextResponse } from "next/server";
import {
  GRADES,
  clampTierValue,
  gradedTier,
  getPack,
  type Entry,
  type Pack,
  type Variant,
  type VariantGrade,
} from "@/lib/draftmasters/packs";
import { callModelJson, hasAnyProvider } from "@/lib/draftmasters/model";
import { formatMenu, getFormat } from "@/lib/draftmasters/contest";

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
  /** 0-10 — how many entries get variants at all */
  variantRate?: number;
  /** 0-10 — how wild the variants are allowed to get */
  variantWild?: number;
}

/** The two dials, clamped. 5 is the house default on both. */
function dial(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 5;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as TopicRequest | null;
  // Long enough to say what you actually mean — qualifiers, exclusions, eras.
  const topic = (body?.topic ?? "").trim().slice(0, 600);
  if (!topic) return NextResponse.json({ error: "topic required" }, { status: 400 });

  const count = Math.max(16, Math.min(32, body?.count ?? 26));
  const rate = dial(body?.variantRate);
  const wild = dial(body?.variantWild);
  if (!hasAnyProvider()) {
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
      const { data: raw } = await callModelJson<Record<string, unknown>>({
        system: systemPrompt(rate, wild),
        user: `Build a draft board of exactly ${attempt.count} entries for this topic:\n\n"${topic}"\n\nRemember: every single entry must satisfy the topic AS WORDED, including any qualifier in it.`,
        // The board is built once behind a loading screen, so this is the one
        // call worth spending real tokens on.
        maxTokens: 12000,
        temperature: attempt.temperature,
        timeoutMs: 40000,
      });

      const pack = sanitize(raw, topic, wild, rate);
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

function systemPrompt(rate: number, wild: number): string {
  return `You build draft boards for DraftMasters, a live auction draft game.

DECIDE THE CONTEST BEFORE YOU LIST ANYBODY. Write the scenario and pick the format first, then build the entries and their variants to fit it. A board whose variants are all about combat power is broken if the contest turns out to be a bake-off.

THE FORMATS — pick the one the topic actually describes:
${formatMenu()}

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

THE TWO DIALS — the player set these, and they are not suggestions:

VARIANT FREQUENCY: ${rate}/10. ${
    rate === 0
      ? "ZERO — give NO entry a variants array at all. Every pick is its plain self."
      : `About ${Math.round(rate * 8.5)}% of entries should have a variants array. ${
          rate <= 3
            ? "Keep it rare: only the handful of entries with a genuinely famous alternate state."
            : rate >= 8
              ? "Almost everybody gets one — hunt for a real alternate state even on the minor entries."
              : "A healthy sprinkle."
        }`
  }

VARIANT WILDNESS: ${wild}/10. This is the tone dial, not a quota — the wildest setting still produces plenty of straight, canonical states, it just reaches further and more often.
${
    wild <= 2
      ? "GROUNDED. Stick to states the source material actually shows: an era, an injury, a piece of gear, a famous night. Nothing invented."
      : wild <= 5
        ? "MOSTLY GROUNDED, with the occasional swing — a legendary what-if or a beloved joke state slipping in every so often."
        : wild <= 8
          ? "PLAYFUL. Reach for the mythic and the ridiculous often: prophesied forms, crossover gear, cursed timelines, humiliating what-ifs. Still anchored to something fans recognise."
          : "UNHINGED. Go big and go often — prophesied god-forms, crossover crimes, absurd handicaps, alternate-timeline nonsense (\"Azor Ahai reborn, flaming sword and all\", \"has just eaten an entire wedding cake\"). Silly and EPIC in the same breath. Keep a decent share of straight canonical states anyway; the contrast is what makes the wild ones land."
  }

VARIANTS — the "(two hands)" mechanic:
Give the chosen entries a "variants" array: the same subject in different iconic states, each with its own tier. This is the signature of the game and the part people quote to each other, so every variant must be FUNNY, COOL, or MEANINGFUL — a specific moment, form, era, piece of gear, or crossover fans would recognise:
- Jaime Lannister -> [{"v":"two hands","g":"boon"},{"v":"one hand","g":"weakening"},{"v":"gold hand, drunk","g":"crippling"}]
- Ser Barristan Selmy -> [{"v":"prime, Barristan the Bold","g":"major"},{"v":"old man","g":"weakening"}]
- Pikachu -> [{"v":"Ash's Pikachu","g":"major"},{"v":"wild, level 3","g":"crippling"}]
- Master Chief -> [{"v":"on a dragon","g":"mythic"},{"v":"no shields","g":"weakening"}]
- Charizard -> [{"v":"Mega Charizard X","g":"mythic"},{"v":"still a level 5 Charmander","g":"crippling"}]
- Dracula -> [{"v":"at night","g":"boon"},{"v":"at high noon","g":"crippling"}]
NEVER use a bare generic state as a variant: not "wounded", "injured", "tired", "weak", "angry", "old", "young", "damaged" on their own. If a condition matters, name the specific one ("burned leg, feverish", "post-Mustafar", "hand cut off by Vader").
THE GRADE MUST POINT THE SAME WAY THE WORDS DO. This is the single most important rule about grades, and getting it backwards is the worst bug in the game: a player reads "sealed away in a coffin" next to an ORANGE chip that promises a big upgrade, and the card is lying to them. Before you write a grade, ask "does this state make them better or worse?" — better is boon/major/mythic, worse is weakening/crippling, and only genuinely does-nothing states are neutral. Never give a handicap a positive grade. Never give a power-up a negative or neutral one.
GRADES MUST BE PROPORTIONATE. A mild or cosmetic setback is "weakening" — a wounded Aragorn is still Aragorn, only slightly worse. Reserve "crippling" for genuinely gutting states: missing sword hand, sealed away, dying, stripped of the thing that makes them powerful.
"NEUTRAL" MEANS IT GENUINELY CHANGES NOTHING. A power-up is never neutral. If the words name a stronger form, a signature weapon, a prime era or a legendary state — "Sage Mode", "Ultra Instinct", "prime", "with the One Ring", "full Infinity Gauntlet" — it is AT LEAST a boon, and usually legendary or mythic. Grey is for the wrong hat and the bad mood, nothing more.
VARIANTS MUST MAKE SENSE IN *THIS* CONTEST. Before you write one, ask what it changes about the thing you decided the format was — a variant that changes nothing is wasted, and a variant about swordsmanship on a cook-off board is a bug.
- A fight / melee / duel board: variants are about power, gear, injuries, forms. "one hand", "Mega Charizard X", "no shields".
- A pokemon board: variants are about the creature's competitive state. "shiny, fully EV-trained", "level 3 and wild", "holding a Focus Sash", "asleep on turn one" — never a knife wound.
- A judged board (pageant, talent, cook-off, fashion): variants are about presentation and nerve. "in the red dress that stopped the room", "hungover, glitter everywhere", "coached for six months by a former winner", "refuses to smile on principle" — NOT combat injuries, which no judge would score.
- A heist, debate or battle-of-wits board: variants are about preparation, information and composure. "with the blueprints memorised", "improvising, no plan at all", "three drinks in".
- A race or sport board: variants are about condition and equipment. "on fresh tyres", "playing through a torn hamstring", "rookie season".
The tier delta must reflect what the variant does IN THIS CONTEST: a wound that ends a fighter barely dents a pageant contestant, and stage fright that means nothing in a brawl is devastating in front of a panel.

EVERY VARIANT NEEDS A GRADE. "g" says how hard it hits, and it is what the player sees as a colour on the card. Do NOT set "t" — the grade sets the tier for you, so a colour can never lie about what it does.
The eight grades, worst to best:
- "crippling" (red): guts them. Missing sword hand, sealed away, dying, stripped of the one thing that makes them powerful.
- "weakening" (light red): hurts, but they're still themselves. A bad leg, a hangover, out of practice.
- "neutral" (grey): changes little. Usually just funny — a bad outfit, a terrible mood, the wrong hat.
- "boon" (green): helps a bit. Well-rested, properly armed, home crowd.
- "major" (blue): a real upgrade. Signature weapon in hand, fully prepared, the good era.
- "legendary" (orange): helps enormously. Prime years at their absolute peak, the famous form fans picture first.
- "exalted" (deep orange): the best they have short of myth. The final evolution, the fully powered state, the one-night-only performance.
- "mythic" (purple): GAME CHANGING. The prophesied form, the mega evolution, the god-mode moment — it should only lose to another mythic, or to two or three oranges stacked against it.
OFFER THE BIG ONES FREELY; THE GAME DECIDES HOW OFTEN THEY LAND. You are writing a menu, not a rolled game. Give a "mythic" option to any entry that genuinely has a legendary form, and a "legendary" or "exalted" to any that has a real peak state — roughly a quarter of your variant entries should carry one. The draft itself rations them: mythics are budgeted to about one per game and a lot of games see none at all, so a generous menu does NOT make them common in play. What it does do is make the one that lands feel earned.
Still: never invent a legendary form that doesn't exist. If a character has no mythic state, they don't get one.
GRADE BY WHAT IT DOES IN *THIS* CONTEST, not in the abstract. Stage fright is neutral in a brawl and crippling in front of a panel; a broken arm is crippling in a race and weakening at a bake-off.
Most variants should still be weakening, neutral or boon — those are the everyday rolls.

MIX LENGTHS. Some variants are two words ("two hands", "prime"); some are a whole vivid situation, up to about a dozen words — "with one dragon, furious after losing the other two", "Old Ben, decades in hiding, sabre still under the bed". A long one should read like a moment fans would picture instantly. One is rolled at random when the lot comes up. Only add variants where a real, recognisable state exists — don't invent nonsense.

OUTPUT — JSON only, this exact shape:
{
  "name": string (short board title, max 4 words),
  "emoji": string (one emoji),
  "blurb": string (one playful sentence, max 12 words),
  "imgContext": string (2-4 words appended to each name for an image search, e.g. "Game of Thrones character", "NBA player", "animal", "anime character"),
  "wiki": string (OPTIONAL but IMPORTANT for fictional topics — the Fandom wiki subdomain where these characters have pages, lowercase, no ".fandom.com". Examples: "gameofthrones", "marvel", "dc", "starwars", "pokemon", "villains" (horror/villain topics), "deathbattle" (anime/versus topics), "harrypotter", "lotr", "zelda", "residentevil", "onepiece", "naruto". Wikipedia has NO usable image for fictional characters, so getting this right is the difference between real character art and a blank card. OMIT it entirely for real-world topics — real people, animals, places, food, history, sports — where Wikipedia is better.),
  "scenario": string (1-2 sentences: the situation both drafted rosters are thrown into — make it concrete and specific to this topic. If the player's topic already names a setting or a contest, USE THEIRS and don't invent a different one),
  "format": string (exactly one of the format ids listed at the top — the one this scenario actually is),
  "criteria": string (1 sentence: what actually decides the winner in that scenario. Be honest about it — if the scenario rewards planning, knowledge or invention, say that intelligence and ingenuity outweigh raw strength),
  "arenas": [ { "name": string (3-5 words, e.g. "An open grass field"), "desc": string (1 sentence appended to the scenario, describing what this setting does to the contest), "weight": number } ]
    (3-5 settings this topic could be played in, ONE is rolled per game. The ordinary, expected setting gets weight 10; genuine twists that flip the board — deep water, killing cold, no sunlight, powers suppressed, a sealed room — get weight 2-4 so they show up occasionally and surprise people. Make each one actually change who wins.),
  "entries": [
    { "n": string (the name, no parentheses in it),
      "t": number 1-5 (base tier),
      "s": string (REQUIRED whenever the name could be a real person or someone from another franchise — put the franchise here: Jon Snow -> "Game of Thrones", Jin -> "Samurai Champloo", Wolverine the animal -> "Gulo gulo animal". A bare "Jon Snow" image search returns a British newsreader.),
      "wiki": string (REQUIRED on crossover/mixed boards — this entry's own Fandom subdomain, e.g. "gameofthrones", "samuraichamploo", "marvel". Omit only when the board-level wiki already covers this entry, or the entry is real-world.),
      "variants": [ {"v": string, "g": "crippling" | "weakening" | "neutral" | "boon" | "major" | "legendary" | "exalted" | "mythic"} ]  (OPTIONAL — no "t", the grade sets it) }
  ]
}

No duplicate names. No commentary outside the JSON.`;
}

// ── Sanitising ───────────────────────────────────────────────────────────────
// The model is good but not trusted — everything gets clamped and de-duped
// before it reaches the auction engine.

function sanitize(raw: Record<string, unknown>, topic: string, wild: number, rate: number): Pack | null {
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
        .map((v): Variant => {
          const g = grade(v?.g, v?.t, entry.t);
          return {
            v: String(v?.v ?? "").trim().replace(/^\(|\)$/g, "").slice(0, 90),
            // The grade is the source of truth: whatever tier the model felt
            // like attaching, the colour and the number must agree.
            t: gradedTier(entry.t, g),
            g,
          };
        })
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

  // Unknown or missing falls back to a melee, same as the judge does.
  const format = getFormat(raw.format).id;

  return {
    ...(wiki ? { wiki } : {}),
    ...(arenas.length ? { arenas } : {}),
    format,
    variantWild: wild,
    variantRate: rate,
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
  // Base tiers stay on the 1-5 scale a board is written on; only a graded
  // variant is allowed above that.
  return Math.max(1, Math.min(5, n));
}

/**
 * The variant's grade. Normally the model just says; a model that ignored the
 * instruction and sent a bare tier still gets graded, from how far it moved.
 */
function grade(g: unknown, t: unknown, baseTier: number): VariantGrade {
  const named = String(g ?? "").trim().toLowerCase() as VariantGrade;
  if (GRADES.includes(named)) return named;

  const tier = Number(t);
  if (!Number.isFinite(tier)) return "neutral";
  const delta = clampTierValue(tier) - baseTier;
  if (delta <= -2) return "crippling";
  if (delta === -1) return "weakening";
  if (delta === 0) return "neutral";
  if (delta === 1) return "boon";
  if (delta === 2) return "major";
  return "mythic";
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function firstEmoji(s: string): string | null {
  const match = s.match(/\p{Extended_Pictographic}/u);
  return match ? match[0] : null;
}
