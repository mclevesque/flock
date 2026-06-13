/**
 * The Great Debate — GROQ integrations.
 *  - moderateTopic(): rejects political/hateful/off-brand topics before a debate is created
 *  - transcribeClip(): Whisper-large-v3 via GROQ for free-tier audio transcription
 *  - judgeDebate(): Escape Pod-style snarky cohost verdict on the transcripts
 *
 * All helpers degrade gracefully: if GROQ is down or the key is missing,
 * they return "null"/fallback values — the debate still works with community votes only.
 */

const GROQ_CHAT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TRANSCRIBE = "https://api.groq.com/openai/v1/audio/transcriptions";

// Keyword prefilter — cheap reject before spending an LLM call.
// Political/electoral/geopolitical/adult terms get an immediate no.
const BANNED_SUBSTRINGS = [
  "election", "elections", "trump", "biden", "obama", "clinton", "harris", "vance",
  "democrat", "republican", "maga", "liberal", "conservative",
  "abortion", "roe v wade",
  "israel", "palestin", "gaza", "hamas", "zionis", "hezbollah",
  "russia", "ukrain", "putin", "zelensky",
  "china taiwan", "ccp", "xi jinping",
  "vaccine", "covid", "pandemic",
  "transgender", "trans rights", "trans kids", "lgbt rights",
  "black lives matter", "blm", "defund",
  "gun control", "second amendment", "2nd amendment",
  "immigration policy", "border wall", "deportat",
  "religion is", "christianity is", "islam is", "muslims are", "jews are",
];

export type ModerationResult =
  | { ok: true }
  | { ok: false; reason: string };

function prefilter(title: string): ModerationResult {
  const lower = title.toLowerCase();
  for (const bad of BANNED_SUBSTRINGS) {
    if (lower.includes(bad)) {
      return { ok: false, reason: "The Great Debate is pop-culture only — political, electoral, or real-world geopolitical topics aren't allowed. Try a media/fandom debate instead." };
    }
  }
  if (title.trim().length < 6) return { ok: false, reason: "Topic is too short. Give us something to argue about." };
  if (title.length > 180) return { ok: false, reason: "Topic is too long — keep it under 180 characters." };
  return { ok: true };
}

export async function moderateTopic(title: string): Promise<ModerationResult> {
  const pre = prefilter(title);
  if (!pre.ok) return pre;

  const key = process.env.GROQ_API_KEY;
  // Without GROQ we only have the prefilter — that's fine, let the topic through.
  if (!key) return { ok: true };

  const system = `You are a strict but fair moderator for a pop-culture debate app. Your job: decide whether a proposed debate topic is appropriate.

REJECT topics that are:
- Political, electoral, partisan, or about real-world policy (abortion, guns, immigration, candidates, parties).
- About real-world geopolitics, active wars, or identifiable ethnic/religious/national groups.
- Hateful, slurs, harassment of real individuals, or sexual content involving minors.
- Not actually debatable (e.g. "Is the sky blue", one-word gibberish, spam).

ACCEPT topics about:
- Fictional media: films, TV, anime, comics, games, books, cartoons, superhero battles.
- Fandom debates, rankings, hot takes, who-would-win hypotheticals.
- Absurd or horny jokes about fictional characters (e.g. "Who's more hung, Hulk or Thanos") — that's fine, it's fictional and silly.
- Opinions about creators' work (e.g. "Nolan is overrated") — that's fine.

Respond ONLY with a JSON object: {"ok": true} OR {"ok": false, "reason": "<one short sentence the user will see>"}.`;

  try {
    const res = await fetch(GROQ_CHAT, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Topic: "${title}"` },
        ],
        max_tokens: 120,
        temperature: 0,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: true }; // fail open — prefilter already ran
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(text);
    if (parsed?.ok === false && typeof parsed.reason === "string") {
      return { ok: false, reason: parsed.reason };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/**
 * Transcribe an audio clip via GROQ Whisper. Returns "" on any failure —
 * transcripts are a nice-to-have (used for AI judge), never gate the recording flow on them.
 */
export async function transcribeClip(audio: Blob, filename: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return "";
  try {
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("model", "whisper-large-v3");
    form.append("response_format", "text");
    const res = await fetch(GROQ_TRANSCRIBE, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return "";
    const text = await res.text();
    return text.trim().slice(0, 4000);
  } catch {
    return "";
  }
}

export interface DebateVerdict {
  ai_winner: "a" | "b" | "tie";
  score_a: number;
  score_b: number;
  roast_line: string;
  reasoning: string;
}

export interface JudgeInput {
  topic: string;
  sideALabel: string;
  sideBLabel: string;
  sideAUser: string;
  sideBUser: string;
  clips: Array<{ side: "a" | "b"; round: number; transcript: string }>;
}

/**
 * Escape Pod-style snarky cohost. Picks a winner, gives per-side scores (0-100),
 * one roast line (the quotable moment), and a short reasoning paragraph.
 */
export async function judgeDebate(input: JudgeInput): Promise<DebateVerdict | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const transcriptBlock = input.clips
    .sort((x, y) => x.round - y.round || (x.side === "a" ? -1 : 1))
    .map(c => `[Round ${c.round} — ${c.side === "a" ? input.sideAUser : input.sideBUser} (${c.side === "a" ? input.sideALabel : input.sideBLabel})]\n${c.transcript || "(no transcript — transcription unavailable)"}`)
    .join("\n\n");

  const system = `You are a cohost on a pop-culture debate podcast — think Escape Pod energy. You're funny, opinionated, a little mean, and you actually pick winners. You are NOT neutral. You're not writing a thesis. You judge the debate, drop a quotable roast line, and move on.

Return a JSON object with this shape:
{
  "ai_winner": "a" | "b" | "tie",
  "score_a": <0-100>,
  "score_b": <0-100>,
  "roast_line": "<one short quotable line calling out the weaker argument — 15 words max, brutal but not cruel>",
  "reasoning": "<2-3 sentences explaining the verdict — casual, opinionated, cite a specific point either side made>"
}

Rules:
- Pick a clear winner unless it's genuinely dead even.
- Scores reflect argument quality, not just vibes. Weak arguments score low even if they were delivered confidently.
- The roast must be about arguments made, not the person.
- No political commentary, even if the topic drifts there. Stay pop-culture.
- If transcripts are missing or empty, say so in the reasoning and split the score evenly.`;

  const user = `Topic: "${input.topic}"
Side A (${input.sideAUser}): "${input.sideALabel}"
Side B (${input.sideBUser}): "${input.sideBLabel}"

Transcripts:
${transcriptBlock}

Render your verdict.`;

  try {
    const res = await fetch(GROQ_CHAT, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 500,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(text);
    const winner = parsed.ai_winner === "a" || parsed.ai_winner === "b" ? parsed.ai_winner : "tie";
    const scoreA = Math.max(0, Math.min(100, Number(parsed.score_a) || 0));
    const scoreB = Math.max(0, Math.min(100, Number(parsed.score_b) || 0));
    return {
      ai_winner: winner,
      score_a: scoreA,
      score_b: scoreB,
      roast_line: String(parsed.roast_line ?? "").slice(0, 240),
      reasoning: String(parsed.reasoning ?? "").slice(0, 800),
    };
  } catch {
    return null;
  }
}
