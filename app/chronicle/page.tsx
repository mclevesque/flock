import { auth } from "@/auth";
import { getChronicleEntries } from "@/lib/db";
import ChronicleClient from "./ChronicleClient";

export const metadata = { title: "Chronicle — FLOCK" };

export default async function ChroniclePage() {
  const session = await auth();
  const entries = await getChronicleEntries(session?.user?.id ?? null, { limit: 20 }).catch(() => []);
  return (
    <ChronicleClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialEntries={entries as any}
      sessionUserId={session?.user?.id ?? null}
      sessionUsername={session?.user?.name ?? null}
      sessionImage={session?.user?.image ?? null}
    />
  );
}
