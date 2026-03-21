import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPendingQuizChallenges, createQuizChallenge, getRecentQuizGames, getQuizLeaderboard, createQuizGame, updateQuizChallengeStatus, sql } from "@/lib/db";
import { generateQuestions, QuizQuestion } from "@/lib/quiz-gen";
export const maxDuration = 60;

// Hardcoded fallback questions used when both AI and opentdb fail
const FALLBACK_QUESTIONS: QuizQuestion[] = [
  { question: "What is the capital of France?", correct_answer: "Paris", incorrect_answers: ["London", "Berlin", "Madrid"], difficulty: "easy" },
  { question: "How many sides does a hexagon have?", correct_answer: "6", incorrect_answers: ["5", "7", "8"], difficulty: "easy" },
  { question: "Which planet is known as the Red Planet?", correct_answer: "Mars", incorrect_answers: ["Venus", "Jupiter", "Saturn"], difficulty: "easy" },
  { question: "What is the chemical symbol for water?", correct_answer: "H₂O", incorrect_answers: ["CO₂", "O₂", "NaCl"], difficulty: "easy" },
  { question: "Who wrote Romeo and Juliet?", correct_answer: "William Shakespeare", incorrect_answers: ["Charles Dickens", "Jane Austen", "Mark Twain"], difficulty: "easy" },
  { question: "What is the largest ocean on Earth?", correct_answer: "Pacific Ocean", incorrect_answers: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"], difficulty: "easy" },
  { question: "In which year did World War II end?", correct_answer: "1945", incorrect_answers: ["1944", "1943", "1946"], difficulty: "medium" },
  { question: "How many bones are in the adult human body?", correct_answer: "206", incorrect_answers: ["196", "216", "226"], difficulty: "medium" },
  { question: "What is the speed of light in km/s (approx)?", correct_answer: "300,000", incorrect_answers: ["150,000", "450,000", "200,000"], difficulty: "medium" },
  { question: "Which element has the atomic number 79?", correct_answer: "Gold", incorrect_answers: ["Silver", "Platinum", "Copper"], difficulty: "medium" },
  { question: "What is the smallest country in the world?", correct_answer: "Vatican City", incorrect_answers: ["Monaco", "San Marino", "Liechtenstein"], difficulty: "hard" },
  { question: "Who painted the Sistine Chapel ceiling?", correct_answer: "Michelangelo", incorrect_answers: ["Leonardo da Vinci", "Raphael", "Donatello"], difficulty: "hard" },
];

// GET — get pending challenges + recent games + leaderboard for current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Auto-expire stale challenges after 1 minute with no response
  await sql`
    UPDATE quiz_challenges SET status = 'declined'
    WHERE status = 'pending'
      AND (dm_game IS NULL OR dm_game = false)
      AND created_at < NOW() - INTERVAL '1 minute'
  `.catch(() => {});
  // Expire old DM challenges after 2 hours (they pile up otherwise)
  await sql`
    UPDATE quiz_challenges SET status = 'declined'
    WHERE status = 'pending'
      AND dm_game = true
      AND created_at < NOW() - INTERVAL '2 hours'
  `.catch(() => {});

  const [pending, recent, leaderboard] = await Promise.all([
    getPendingQuizChallenges(session.user.id),
    getRecentQuizGames(session.user.id),
    getQuizLeaderboard(),
  ]);

  return NextResponse.json({ pending, recent, leaderboard });
}

// POST — send a challenge OR cancel an outgoing challenge
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Cancel own outgoing challenge
  if (body.action === "cancel") {
    const { challengeId } = body;
    if (!challengeId) return NextResponse.json({ error: "challengeId required" }, { status: 400 });
    await sql`
      UPDATE quiz_challenges SET status = 'declined'
      WHERE id = ${challengeId} AND challenger_id = ${session.user.id} AND status = 'pending'
    `;
    return NextResponse.json({ ok: true });
  }

  const { challengedId, topic, dmGame } = body;
  if (!challengedId) return NextResponse.json({ error: "challengedId required" }, { status: 400 });
  if (challengedId === session.user.id) return NextResponse.json({ error: "Can't challenge yourself" }, { status: 400 });

  // Ensure quiz columns exist (safe migration)
  await sql`ALTER TABLE quiz_challenges ADD COLUMN IF NOT EXISTS dm_game BOOLEAN DEFAULT false`.catch(() => {});
  await sql`ALTER TABLE quiz_games ADD COLUMN IF NOT EXISTS dm_game BOOLEAN DEFAULT false`.catch(() => {});

  // Generate questions now so accepting is instant; always fall back to hardcoded set
  let questions: QuizQuestion[] = [];
  let resolvedTopic = topic || "General Knowledge";
  try {
    ({ questions, resolvedTopic } = await generateQuestions(resolvedTopic));
  } catch {
    // Both AI and opentdb failed — use hardcoded fallback so DM game always starts
  }
  if (questions.length < 6) questions = FALLBACK_QUESTIONS;

  // Expire any existing pending/active DM quiz between these two users before creating a new one
  await sql`
    UPDATE quiz_challenges SET status = 'declined'
    WHERE status IN ('pending', 'accepted') AND dm_game = true
      AND ((challenger_id = ${session.user.id} AND challenged_id = ${challengedId})
        OR (challenger_id = ${challengedId} AND challenged_id = ${session.user.id}))
  `.catch(() => {});

  try {
    const id = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    const challenge = await createQuizChallenge(id, session.user.id, challengedId, resolvedTopic, questions, !!dmGame);

    // DM quizzes start immediately — no acceptance required
    if (dmGame) {
      const gameId = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
      await createQuizGame(gameId, id, session.user.id, challengedId, resolvedTopic, questions, true);
      await updateQuizChallengeStatus(id, "accepted");
      return NextResponse.json({ ...challenge, gameId });
    }

    return NextResponse.json(challenge);
  } catch (err) {
    console.error("Quiz challenge creation failed:", err);
    return NextResponse.json({ error: "Failed to create quiz" }, { status: 500 });
  }
}
