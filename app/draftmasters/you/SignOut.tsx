"use client";

import { signOut } from "next-auth/react";

/** The one control on this page that changes anything. */
export default function SignOut() {
  return (
    <button
      type="button"
      className="dm-btn dm-btn-ghost"
      onClick={() => void signOut({ callbackUrl: "/draftmasters" })}
    >
      Sign out
    </button>
  );
}
