"use client";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// Clerk redirects here after OAuth, then forwards to /onboarding
export default function SSOCallback() {
  return <AuthenticateWithRedirectCallback />;
}
