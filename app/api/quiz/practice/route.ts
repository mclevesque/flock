import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createBotQuizGame } from "@/lib/db";
import { generateQuestions } from "@/lib/quiz-gen";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { topic } = await req.json();
  const topicStr = (topic ?? "General Knowledge").trim() || "General Knowledge";

  let questions;
  try {
    questions = await generateQuestions(topicStr);
  } catch {
    return NextResponse.json({ error: "Could not generate questions" }, { status: 500 });
  }

  const gameId = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  await createBotQuizGame(gameId, session.user.id, topicStr, questions);
  return NextResponse.json({ gameId });
}
