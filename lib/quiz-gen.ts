/**
 * Shared quiz question generator — used by BOTH the main quiz and the DM inline quiz.
 * Priority: Groq (fast, free) → HuggingFace (free, existing token) → OpenTDB (topic-agnostic fallback)
 */

export interface QuizQuestion {
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
  difficulty: "easy" | "medium" | "hard";
}

const SYSTEM_PROMPT = "You are an expert trivia writer. ACCURACY IS YOUR #1 PRIORITY. If you are not 100% certain a fact is correct, DO NOT write that question — replace it with one you ARE certain about. For every question, ask: (1) Am I 100% sure this is factually correct? If not → replace. (2) Can a knowledgeable fan name a second valid answer? If yes → rewrite or replace. (3) Is this a shared trait of a whole group? If yes → replace. Stick to MAJOR, ICONIC facts — main character deaths, famous relationships, powers/abilities, iconic scenes, species/types, episode-defining moments. AVOID obscure details where you might be wrong. Every correct_answer must be something you can verify with certainty. RESPOND ONLY with a valid JSON array, no other text.";

const USER_PROMPT = (topic: string) =>
  `Generate exactly 12 trivia questions about "${topic}". Make them fun, specific, and rewarding to know. Mix: (1) FACTS — specific numbers, names, dates, rules, (2) EVENTS — unique plot/historical moments anchored to a specific scene, (3) FUN — interesting questions with a single clear answer. Rules: 4 easy, 4 medium, 4 hard. Keep questions under 120 chars, answers under 60 chars. Wrong answers must be plausible from the same universe/topic.
FORBIDDEN: Shared traits, vague roles, subjective opinions, questions with multiple valid answers, anything you're not 100% certain is correct.
RESPOND ONLY with a valid JSON array: [{"question":"...","correct_answer":"...","incorrect_answers":["...","...","..."],"difficulty":"easy"},...]`;

function parseQuestions(text: string): QuizQuestion[] {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  // Find JSON array in response
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found");
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed) || parsed.length < 6) throw new Error("Too few questions");
  return parsed.slice(0, 12);
}

// ── Primary: Groq (free, fast, 30 req/min) ──────────────────────────────────
async function tryGroq(topic: string): Promise<QuizQuestion[]> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("No GROQ_API_KEY");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: USER_PROMPT(topic) }],
      max_tokens: 2048,
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(text);
  const questions: QuizQuestion[] = Array.isArray(parsed)
    ? parsed
    : (parsed.questions ?? parsed[Object.keys(parsed)[0]] ?? []);
  if (!Array.isArray(questions) || questions.length < 6) throw new Error("Too few questions");
  return questions.slice(0, 12);
}

// ── Secondary: HuggingFace Mixtral (free, existing HUGGINGFACE_TOKEN) ────────
async function tryHuggingFace(topic: string): Promise<QuizQuestion[]> {
  const key = process.env.HUGGINGFACE_TOKEN;
  if (!key) throw new Error("No HUGGINGFACE_TOKEN");

  const res = await fetch(
    "https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1/v1/chat/completions",
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        messages: [{ role: "user", content: `${SYSTEM_PROMPT}\n\n${USER_PROMPT(topic)}` }],
        max_tokens: 2048,
        temperature: 0.1,
      }),
    }
  );

  if (!res.ok) throw new Error(`HuggingFace ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  return parseQuestions(text);
}

// ── Tertiary: OpenTDB (topic-agnostic, no key needed) ────────────────────────
export async function generateQuestionsOpentdb(): Promise<QuizQuestion[]> {
  const res = await fetch("https://opentdb.com/api.php?amount=12&type=multiple&encode=url3986");
  const data = await res.json();
  if (data.response_code !== 0 || !Array.isArray(data.results)) throw new Error("opentdb failed");
  return data.results.map((q: { question: string; correct_answer: string; incorrect_answers: string[] }, i: number) => ({
    question: decodeURIComponent(q.question),
    correct_answer: decodeURIComponent(q.correct_answer),
    incorrect_answers: q.incorrect_answers.map((a: string) => decodeURIComponent(a)),
    difficulty: (i < 4 ? "easy" : i < 8 ? "medium" : "hard") as "easy" | "medium" | "hard",
  }));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export async function generateQuestions(topic: string): Promise<{ questions: QuizQuestion[]; resolvedTopic: string }> {
  // Try Groq first (fast, free)
  try {
    const questions = await withTimeout(tryGroq(topic), 20000);
    return { questions, resolvedTopic: topic };
  } catch (e) {
    console.error("Groq failed:", e);
  }

  // Try HuggingFace second (free, existing token)
  try {
    const questions = await withTimeout(tryHuggingFace(topic), 30000);
    return { questions, resolvedTopic: topic };
  } catch (e) {
    console.error("HuggingFace failed:", e);
  }

  // Last resort: OpenTDB — topic-agnostic, clearly labeled
  try {
    const questions = await withTimeout(generateQuestionsOpentdb(), 8000);
    const label = topic === "General Knowledge" ? topic : `General Knowledge (${topic} questions unavailable)`;
    return { questions, resolvedTopic: label };
  } catch (e) {
    console.error("OpenTDB failed:", e);
    throw new Error("All question sources failed");
  }
}
