import { auth } from "@/auth";
import { getBudiLogsForUser, getUserById } from "@/lib/db";
import BudiAuth from "./BudiAuth";
import BudiHome from "./BudiHome";

export const dynamic = "force-dynamic";

export default async function BudiPage() {
  const session = await auth();
  if (!session?.user?.id) return <BudiAuth />;

  const userId = session.user.id;
  const [logs, user] = await Promise.all([
    getBudiLogsForUser(userId).catch(() => []),
    getUserById(userId).catch(() => null),
  ]);

  const me = {
    id: userId,
    username: (user?.username as string) ?? session.user.name ?? "you",
    avatarUrl: (user?.avatar_url as string) ?? null,
  };

  // Serialize to strip Date objects before crossing the server→client boundary
  return <BudiHome initialLogs={JSON.parse(JSON.stringify(logs))} me={me} />;
}
