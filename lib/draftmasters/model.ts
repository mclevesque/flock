/**
 * DraftMasters — the model call, and the chain behind it.
 *
 * Every AI route in this game (judge, battle, topic, argue) used to hold its
 * own inline fetch to Groq. That meant one provider having a bad day took the
 * whole game down to the offline scorer, and Groq's free tier is a *token*
 * budget — 200k/day — which a handful of drafts will exhaust, because one game
 * is four calls and the board builder alone can ask for 12k output tokens.
 *
 * So calls go through `callModel`, which tries providers in order and only
 * gives up when all of them fail. The caller still catches and falls back to
 * its offline path, but it should almost never get there now.
 *
 * Adding a provider: write an adapter and add it to PROVIDERS. Anything with
 * no API key configured is skipped, so a missing key degrades the chain
 * instead of breaking it.
 */

export interface ModelRequest {
  system: string;
  user: string;
  /** Output tokens the CALLER needs. Providers that bill thinking against the same budget get headroom added for them. */
  maxTokens: number;
  temperature?: number;
  /** Response must parse as JSON. Every current caller needs this. */
  json?: boolean;
  timeoutMs?: number;
}

export interface ModelResult {
  text: string;
  provider: string;
  model: string;
}

/**
 * Groq's model. Groq retires models on its own schedule — the
 * llama-3.3-70b-versatile this was written against no longer exists on the
 * account. If Groq starts failing, check
 * `GET https://api.groq.com/openai/v1/models` and change this line.
 */
export const DRAFT_MODEL = "openai/gpt-oss-120b";

/**
 * Gemini's model. NOT gemini-2.5-flash — that still appears in the models
 * list but is closed to new users and 404s on generateContent, which looks
 * exactly like a typo until you read the error body.
 */
export const GEMINI_MODEL = "gemini-3.6-flash";

class ModelError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

// ── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(req: ModelRequest, key: string): Promise<string> {
  /**
   * Thinking tokens count against maxOutputTokens on this model, and they
   * dwarf the answer — a one-line question spent 285 thinking to produce 11.
   * Passing the caller's budget straight through truncates mid-sentence and
   * returns unparseable JSON, so the answer needs room for the thinking in
   * front of it. 65536 is the model's ceiling.
   */
  const outputBudget = Math.min(65536, req.maxTokens + Math.max(2048, Math.round(req.maxTokens * 0.8)));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ parts: [{ text: req.user }] }],
        generationConfig: {
          temperature: req.temperature ?? 0.8,
          maxOutputTokens: outputBudget,
          ...(req.json === false ? {} : { responseMimeType: "application/json" }),
          // Thinking cannot be switched off (thinkingBudget: 0 is rejected),
          // but "low" cut a test call from 10.7s to 3.2s. Without this the
          // battle route would routinely run past its own timeout.
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
      signal: AbortSignal.timeout(req.timeoutMs ?? 45000),
    }
  );

  if (!res.ok) {
    // 429 is the daily quota; 503 is a capacity spike and worth another go.
    throw new ModelError(`gemini ${res.status}`, res.status === 503 || res.status === 429);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text: string = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? "")
    .join("");

  // A truncated answer is a FAILURE, not a result. It parses as invalid JSON,
  // the caller's sanitiser drops it, and the game silently falls back — which
  // reads as "the AI is broken" with nothing in the logs to say why.
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new ModelError("gemini truncated (MAX_TOKENS)", false);
  }
  if (!text.trim()) throw new ModelError("gemini returned nothing", true);
  return text;
}

// ── Groq ─────────────────────────────────────────────────────────────────────

async function callGroq(req: ModelRequest, key: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: DRAFT_MODEL,
      max_tokens: req.maxTokens,
      reasoning_effort: "medium",
      temperature: req.temperature ?? 0.8,
      ...(req.json === false ? {} : { response_format: { type: "json_object" } }),
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    }),
    signal: AbortSignal.timeout(req.timeoutMs ?? 45000),
  });

  if (!res.ok) {
    throw new ModelError(`groq ${res.status}`, res.status === 503 || res.status === 429);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new ModelError("groq returned nothing", true);
  return text;
}

// ── DeepSeek ─────────────────────────────────────────────────────────────────

/**
 * OpenAI-compatible, so this is Groq's adapter with a different host.
 *
 * It earns its place as the paid link because it is PREPAID: you top up a
 * balance and it simply stops when that balance is gone. That is a real
 * ceiling, unlike a Google Cloud budget, which only emails you while the
 * charges keep accruing. The cap is the payment model, not a config flag
 * anyone can misread.
 */
async function callDeepSeek(req: ModelRequest, key: string): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: req.maxTokens,
      temperature: req.temperature ?? 0.8,
      ...(req.json === false ? {} : { response_format: { type: "json_object" } }),
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    }),
    signal: AbortSignal.timeout(req.timeoutMs ?? 45000),
  });

  if (!res.ok) {
    // 402 is an empty balance — not retryable, and the cue to top up.
    throw new ModelError(`deepseek ${res.status}`, res.status === 503 || res.status === 429);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new ModelError("deepseek returned nothing", true);
  return text;
}

// ── The chain ────────────────────────────────────────────────────────────────

interface Provider {
  name: string;
  model: string;
  envKey: string;
  call: (req: ModelRequest, key: string) => Promise<string>;
}

/**
 * Order matters, and it is SPEED first, not budget.
 *
 * The instinct is to lead with Gemini because its daily allowance is far
 * larger. Measured, that is the wrong way round: the judge route takes ~38s on
 * Gemini against ~10-15s on Groq, because Gemini thinks on every call and
 * cannot be told not to. Leading with Gemini would make every game slow even
 * while the fast provider sat unused.
 *
 * Leading with Groq gives a degradation curve instead of a flat penalty: fast
 * for the first stretch of the day, slower but plentiful once Groq's 200k
 * tokens are gone, offline only if both are down. Groq's budget is small
 * precisely because it is the one worth spending first.
 */
const PROVIDERS: Provider[] = [
  { name: "groq", model: DRAFT_MODEL, envKey: "GROQ_API_KEY", call: callGroq },
  { name: "gemini", model: GEMINI_MODEL, envKey: "GEMINI_API_KEY", call: callGemini },
  // Paid, and deliberately last: the free tiers absorb ordinary play, so this
  // only ever spends money on the days both of them are exhausted. Inert until
  // DEEPSEEK_API_KEY exists, so adding it later needs no code change.
  { name: "deepseek", model: "deepseek-chat", envKey: "DEEPSEEK_API_KEY", call: callDeepSeek },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** True when every provider is unconfigured — the caller should go offline immediately. */
export function hasAnyProvider(): boolean {
  return PROVIDERS.some((p) => Boolean(process.env[p.envKey]));
}

/**
 * Ask the chain. Returns the first usable answer; throws only when every
 * configured provider has failed, which is the caller's cue to go offline.
 *
 * Retryable failures (429, 503, empty body) get one more attempt on the same
 * provider before moving on — a capacity spike is usually over in a second,
 * and switching away from it costs more than waiting.
 */
export async function callModel(req: ModelRequest): Promise<ModelResult> {
  const failures: string[] = [];

  for (const provider of PROVIDERS) {
    const key = process.env[provider.envKey];
    if (!key) continue;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await provider.call(req, key);
        return { text, provider: provider.name, model: provider.model };
      } catch (err) {
        const retryable = err instanceof ModelError ? err.retryable : true;
        const label = err instanceof Error ? err.message : String(err);
        if (retryable && attempt === 0) {
          await sleep(700);
          continue;
        }
        failures.push(`${provider.name}: ${label}`);
        break;
      }
    }
  }

  throw new Error(`all model providers failed — ${failures.join("; ")}`);
}

/**
 * `callModel` plus JSON.parse, since all four callers do exactly this and a
 * provider that returns prose where JSON was asked for should count as a
 * failure of that provider rather than crashing the route.
 */
export async function callModelJson<T = unknown>(req: ModelRequest): Promise<{ data: T; provider: string }> {
  const result = await callModel({ ...req, json: true });
  try {
    return { data: JSON.parse(result.text) as T, provider: result.provider };
  } catch {
    throw new Error(`${result.provider} returned unparseable JSON`);
  }
}
