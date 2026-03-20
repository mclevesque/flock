import { auth } from "@/auth";
import { getSnesLeaderboard, getSfLeaderboard, getMkLeaderboard, getActiveEmulatorRooms, getPrivileges } from "@/lib/db";
import EmulatorClient from "./EmulatorClient";
import { notFound } from "next/navigation";

export default async function EmulatorPage() {
  const session = await auth();

  let leaderboard: Record<string, unknown>[] = [];
  let sfLeaderboard: Record<string, unknown>[] = [];
  let mkLeaderboard: Record<string, unknown>[] = [];
  let rooms: Record<string, unknown>[] = [];
  let hasSnesAccess = false;
  try {
    [leaderboard, sfLeaderboard, mkLeaderboard, rooms] = await Promise.all([
      getSnesLeaderboard(),
      getSfLeaderboard(),
      getMkLeaderboard(),
      getActiveEmulatorRooms(),
    ]);
    if (session?.user?.id) {
      const priv = await getPrivileges(session.user.id).catch(() => null);
      // Default to TRUE — all users have SNES access unless explicitly revoked
      hasSnesAccess = priv?.snes_access ?? true;
    } else {
      hasSnesAccess = false; // not logged in
    }
  } catch { /* tables may not exist yet — /api/init-db will fix */ }

  // Require login but don't 404 on DB errors — default to open
  if (!session?.user?.id) return notFound();

  return (
    <EmulatorClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      leaderboard={leaderboard as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sfLeaderboard={sfLeaderboard as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mkLeaderboard={mkLeaderboard as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rooms={rooms as any}
      sessionUserId={session?.user?.id ?? null}
      sessionUsername={session?.user?.name ?? null}
      hasSnesAccess={true}
    />
  );
}
