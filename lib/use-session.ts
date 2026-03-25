"use client";
// Drop-in replacement for `next-auth/react` useSession + signOut.
// Checks NextAuth session first (credentials/GitHub users), then Clerk
// (Google / Discord users). Import from here instead of next-auth/react.

import { useSession as useNASession, signOut as naSignOut } from "next-auth/react";
import { useUser, useClerk } from "@clerk/nextjs";

export function useSession() {
  const na = useNASession();
  const { user: clerkUser, isLoaded } = useUser();

  // NextAuth credentials session takes priority
  if (na.data?.user?.id) return na;

  // Clerk session (Google / Discord users)
  if (!isLoaded) {
    return { data: null, status: "loading" as const, update: async () => {} };
  }
  if (!clerkUser) {
    return { data: null, status: "unauthenticated" as const, update: async () => {} };
  }

  const meta = (clerkUser.publicMetadata ?? {}) as {
    username?: string;
    avatar_url?: string;
  };

  return {
    data: {
      user: {
        id: clerkUser.id,
        name: meta.username ?? clerkUser.username ?? clerkUser.firstName ?? clerkUser.id,
        image: meta.avatar_url ?? clerkUser.imageUrl ?? null,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
      },
    },
    status: "authenticated" as const,
    update: async () => {},
  };
}

// signOut works for both NextAuth and Clerk sessions
export async function signOut(options?: { callbackUrl?: string }) {
  const url = options?.callbackUrl ?? "/";
  if (typeof window === "undefined") return;
  // window.Clerk is set globally by @clerk/nextjs when a Clerk session is active
  const clerkGlobal = (window as unknown as { Clerk?: { session?: unknown; signOut?: (opts: { redirectUrl: string }) => Promise<void> } }).Clerk;
  if (clerkGlobal?.session) {
    await clerkGlobal.signOut?.({ redirectUrl: url });
  } else {
    await naSignOut({ callbackUrl: url });
  }
}

// Re-export useClerk so components can access Clerk-specific features
export { useClerk };

// Stub signIn for components that import it — redirects to the sign-in page
export function signIn(_provider?: string, options?: { callbackUrl?: string }) {
  if (typeof window !== "undefined") {
    window.location.href = "/signin" + (options?.callbackUrl ? `?callbackUrl=${encodeURIComponent(options.callbackUrl)}` : "");
  }
}
