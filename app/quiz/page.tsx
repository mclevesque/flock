import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPendingQuizChallenges, getRecentQuizGames, getQuizLeaderboard, getAllUsers } from "@/lib/db";
import QuizHubClient from "./QuizHubClient";

export default async function QuizPage({ searchParams }: { searchParams: Promise<{ challengeUserId?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const params = await searchParams;
  const [pending, recent, leaderboard, allUsers] = await Promise.all([
    getPendingQuizChallenges(session.user.id),
    getRecentQuizGames(session.user.id),
    getQuizLeaderboard(),
    getAllUsers(),
  ]);

  return (
    <QuizHubClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pending={pending as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recent={recent as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      leaderboard={leaderboard as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allUsers={allUsers as any}
      sessionUserId={session.user.id}
      initialChallengeUserId={params.challengeUserId}
    />
  );
}
