export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getQuizGame } from "@/lib/db";
import QuizGameClient from "./QuizGameClient";

export default async function QuizGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const game = await getQuizGame(id);
  if (!game) notFound();

  const isPlayer = game.player1_id === session.user.id || game.player2_id === session.user.id;
  if (!isPlayer) redirect("/quiz");

  return (
    <QuizGameClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialGame={game as any}
      sessionUserId={session.user.id}
    />
  );
}
