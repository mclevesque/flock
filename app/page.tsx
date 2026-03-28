import { auth } from "@/auth";
import { redirect } from "next/navigation";
import HubClient from "./components/HubClient";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  return <HubClient username={session.user.name ?? ""} userId={session.user.id ?? ""} />;
}
