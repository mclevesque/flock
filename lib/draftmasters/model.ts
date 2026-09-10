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
  /**
   * Total wall-clock the whole provider chain may spend, including failover
   * and retries. Set it to what the CALLER has left, not to what one request
   * should take — a serverless function that overruns is killed and answers
   * with HTML instead of JSON.
   */
  deadlineMs?: number;
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

class ModelError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

/**
 * How much output budget to actually ask Groq for.
 *
 * The reasoning model spends tokens thinking before it writes, and those come
 * out of `max_tokens`, so the answer needs room for the thinking in front of
 * it. Capped at the model's ceiling.
 */
function groqBudget(want: number): number {
  return Math.min(32768, want + Math.max(2048, Math.round(want * 0.8)));
}

// ── Groq ─────────────────────────────────────────────────────────────────────

async function callGroq(req: ModelRequest, key: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: DRAFT_MODEL,
      // Reasoning tokens come out of this same budget. Without the headroom a
      // long ask (the battle story) spends most of its allowance thinking and
      // gets cut off mid-sentence.
      max_tokens: groqBudget(req.maxTokens),
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
  const choice = data?.choices?.[0];
  const text: string = choice?.message?.content ?? "";
  // A truncated answer is a FAILURE, not a result. Letting it through returns
  // half a story that still parses well enough to render, so the player
  // watches a battle stop in the middle of itself and nothing anywhere says
  // why.
  if (choice?.finish_reason === "length") {
    throw new ModelError("groq truncated (length)", false);
  }
  if (!text.trim()) throw new ModelError("groq returned nothing", true);
  return text;
}

// ── DeepSeek ─────────────────────────────────────────────────────────────────

/**
 * OpenAI-compatible, so this is Groq's adapter with a different host.
 *
 * This is the link with credits behind it, and it is safe to lead with because
 * it is PREPAID: you top up a balance and it simply stops when that balance is
 * gone. That is a real ceiling, unlike a cloud budget that only emails you
 * while the charges keep accruing. The cap is the payment model, not a config
 * flag anyone can misread.
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
  const choice = data?.choices?.[0];
  const text: string = choice?.message?.content ?? "";
  // Same rule as Groq: a cut-off answer is a failure, not a short story.
  if (choice?.finish_reason === "length") {
    throw new ModelError("deepseek truncated (length)", false);
  }
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
 * Order matters, and it is the ALLOWANCE WE ACTUALLY HAVE first.
 *
 * DeepSeek is the account with credits on it, so it leads. Groq is a free
 * tier behind it, and a free tier does not degrade by getting slower -- it
 * refuses, and a refusal mid-battle costs a whole story. Better to spend the
 * balance that exists and keep the free one as the safety net.
 *
 * DeepSeek is prepaid, which is the real reason it is safe to lead with: it
 * stops when the balance is gone rather than quietly accruing charges.
 *
 * Gemini used to sit in this chain and has been removed outright -- there are
 * no credits behind that key, so every call to it was a request that could
 * only fail or bill somebody.
 */
const PROVIDERS: Provider[] = [
  { name: "deepseek", model: "deepseek-chat", envKey: "DEEPSEEK_API_KEY", call: callDeepSeek },
  { name: "groq", model: DRAFT_MODEL, envKey: "GROQ_API_KEY", call: callGroq },
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

  /**
   * One budget for the whole chain, not one per call.
   *
   * `timeoutMs` was applied to each individual request, and the chain is three
   * providers with two attempts apiece — so a caller asking for 24 seconds was
   * authorising up to 144, and a board that fell through to the third provider
   * ran 68 seconds against a 45-second function. The platform kills the
   * function at that point and answers with its own HTML page, which is what
   * put `Unexpected token '<', "<HTML> <HE"...` in front of the player.
   *
   * Failover is still worth having; it just has to fit in the time the caller
   * actually has. Providers are tried until the budget is gone, then the chain
   * gives up cleanly and the route returns its own JSON error.
   */
  const budgetMs = req.deadlineMs ?? (req.timeoutMs ?? 45000) * 2;
  const startedAt = Date.now();
  const left = () => budgetMs - (Date.now() - startedAt);
  // Below this a request cannot realistically land, and starting one only
  // guarantees it is still in flight when the function is killed.
  const MIN_SLICE = 6000;

  for (const provider of PROVIDERS) {
    const key = process.env[provider.envKey];
    if (!key) continue;
    if (left() < MIN_SLICE) {
      failures.push(`${provider.name}: skipped, out of time`);
      continue;
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      const slice = Math.min(req.timeoutMs ?? 45000, left());
      if (slice < MIN_SLICE) break;
      try {
        const text = await provider.call({ ...req, timeoutMs: slice }, key);
        return { text, provider: provider.name, model: provider.model };
      } catch (err) {
        const retryable = err instanceof ModelError ? err.retryable : true;
        const label = err instanceof Error ? err.message : String(err);
        if (retryable && attempt === 0 && left() > MIN_SLICE + 700) {
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
