import { auth } from "@/auth";
import BlindRankClient from "./BlindRankClient";

export const metadata = { title: "BL!NDR4NK — Great Souls" };

export default async function BlindRankPage() {
  const session = await auth();
  return <BlindRankClient username={session?.user?.name ?? null} />;
}
