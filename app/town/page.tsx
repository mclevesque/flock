export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function TownPage() {
  redirect("/moonhaven");
}
