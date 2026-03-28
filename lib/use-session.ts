"use client";
// Session hook — wraps next-auth/react useSession + signOut.
// Import from here instead of next-auth/react.

import { useSession as useNASession, signOut as naSignOut } from "next-auth/react";

export function useSession() {
  return useNASession();
}

export async function signOut(options?: { callbackUrl?: string }) {
  await naSignOut({ callbackUrl: options?.callbackUrl ?? "/" });
}

// Stub signIn for components that import it — redirects to the sign-in page
export function signIn(_provider?: string, options?: { callbackUrl?: string }) {
  if (typeof window !== "undefined") {
    window.location.href = "/signin" + (options?.callbackUrl ? `?callbackUrl=${encodeURIComponent(options.callbackUrl)}` : "");
  }
}
