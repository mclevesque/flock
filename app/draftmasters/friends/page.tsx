import { redirect } from "next/navigation";
import { auth } from "@/auth";
import FriendsClient from "./FriendsClient";
import { STYLES } from "../styles";

export const metadata = { title: "Friends — DraftMasters" };

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/signin?next=/draftmasters/friends");
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <FriendsClient myName={session.user.name ?? "you"} />
    </>
  );
}
