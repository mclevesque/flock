export const dynamic = "force-dynamic";

import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserById } from "@/lib/db";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const { userId } = await clerkAuth();

  // Not signed in via Clerk — redirect to sign-in
  if (!userId) redirect("/signin");

  // Already onboarded (has a DB entry with username) → go to profile
  try {
    const existing = await getUserById(userId);
    if (existing?.username) redirect("/profile");
  } catch {
    // DB unavailable — continue to onboarding
  }

  const user = await currentUser();

  // Detect Discord to offer avatar choice
  const isDiscord = user?.externalAccounts?.some(
    (a) => a.provider === "oauth_discord"
  ) ?? false;

  const discordAvatar = isDiscord ? (user?.imageUrl ?? null) : null;

  // For Discord: prefer the Discord username from externalAccounts
  const discordUsername = isDiscord
    ? user?.externalAccounts?.find((a) => a.provider === "oauth_discord")?.username ?? null
    : null;

  const displayName =
    discordUsername ??
    user?.username ??
    user?.firstName ??
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ??
    "";

  return (
    <OnboardingClient
      userId={userId}
      displayName={displayName}
      isDiscord={isDiscord}
      discordAvatar={discordAvatar}
    />
  );
}
