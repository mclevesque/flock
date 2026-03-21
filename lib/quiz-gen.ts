/**
 * Shared quiz question generator — used by BOTH the main quiz and the DM inline quiz.
 * Edit this file to change questions for ALL quiz modes at once.
 */

export interface QuizQuestion {
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
  difficulty: "easy" | "medium" | "hard";
}

export async function generateQuestionsAI(topic: string): Promise<QuizQuestion[]> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("No GROQ_API_KEY");

  const prompt = `Generate exactly 12 trivia questions about "${topic}". Make them fun, specific, and rewarding to know. Mix: (1) FACTS — specific numbers, names, dates, rules (e.g. "How many Horcruxes did Voldemort create?"), (2) EVENTS — unique plot moments anchored to a specific scene (e.g. "Who kills Mufasa in The Lion King?"), (3) FUN — cheeky ship/drama questions anchored to a single clear answer (e.g. "Who does Ron Weasley end up marrying?"). Rules: 4 easy, 4 medium, 4 hard. Keep questions under 120 chars, answers under 60 chars. Wrong answers must be plausible from the same universe. RESPOND ONLY with a valid JSON array — no text outside it: [{"question":"...","correct_answer":"...","incorrect_answers":["...","...","..."],"difficulty":"easy"},...]

FORBIDDEN question patterns:
- Shared traits: "Who loves food/adventure?" (could be many characters)
- Vague roles: "Who is the sheriff/mayor/leader?" (only ask if this is iconic and you are CERTAIN of the answer)
- Subjective: "Who is the strongest/bravest/most popular?"
- Multiple valid answers: any question a fan could argue about
- Anything you're not 100% certain is factually correct — if uncertain, skip it and write a different question`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert trivia writer. ACCURACY IS YOUR #1 PRIORITY. If you are not 100% certain a fact is correct, DO NOT write that question — replace it with one you ARE certain about. For every question, ask: (1) Am I 100% sure this is factually correct? If not → replace. (2) Can a knowledgeable fan name a second valid answer? If yes → rewrite or replace. (3) Is this a shared trait of a whole group? If yes → replace. Stick to MAJOR, ICONIC facts — main character deaths, famous relationships, powers/abilities, iconic scenes, species/types, episode-defining moments. AVOID obscure details like minor character titles or background roles where you might be wrong. Examples of BAD questions: 'Which hobbit loved food?' (all do), 'Who was Hand of the King?' (many held this role), 'Who is the sheriff?' (secondary character detail — easily wrong). Every correct_answer must be something you can verify with certainty.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2048,
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(text);
  const questions: QuizQuestion[] = Array.isArray(parsed)
    ? parsed
    : (parsed.questions ?? parsed[Object.keys(parsed)[0]] ?? []);
  if (!Array.isArray(questions) || questions.length < 6) throw new Error("Too few questions");
  return questions.slice(0, 12);
}

export async function generateQuestionsOpentdb(): Promise<QuizQuestion[]> {
  const res = await fetch("https://opentdb.com/api.php?amount=12&type=multiple&encode=url3986");
  const data = await res.json();
  if (data.response_code !== 0 || !Array.isArray(data.results)) throw new Error("opentdb failed");
  return data.results.map((q: { difficulty: string; question: string; correct_answer: string; incorrect_answers: string[] }, i: number) => ({
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
  try {
    const questions = await withTimeout(generateQuestionsAI(topic), 45000);
    return { questions, resolvedTopic: topic };
  } catch (aiErr) {
    console.error("AI question generation failed, trying opentdb:", aiErr);
    try {
      const questions = await withTimeout(generateQuestionsOpentdb(), 8000);
      // opentdb is topic-agnostic — tell the game it's general knowledge
      return { questions, resolvedTopic: "General Knowledge" };
    } catch (fallbackErr) {
      console.error("opentdb fallback also failed:", fallbackErr);
      throw new Error("Could not generate questions");
    }
  }
}
