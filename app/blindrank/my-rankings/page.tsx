import { auth } from "@/auth";
import { redirect } from "next/navigation";
import BlindRankMyRankingsClient from "./BlindRankMyRankingsClient";

export const metadata = { title: "BL!NDR4NK — My Rankings" };

export default async function BlindRankMyRankingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/blindrank/my-rankings");

  return <BlindRankMyRankingsClient />;
}
