"use client";
import { useEffect } from "react";
import { signOut } from "@/lib/use-session";
import { useSession } from "@/lib/use-session";

const IDLE_MS = 10 * 60 * 1000; // 10 minutes

// Signs out any authenticated tab that has had no user input for 10 minutes.
// Covers forgotten tabs on Android, second PCs, shared computers, etc.
// Kills authenticated polling (Moonhaven, /api/town) when no one is actually there.
export default function IdleLogout() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user) return; // not logged in — nothing to do

    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        signOut({ callbackUrl: "/signin" });
      }, IDLE_MS);
    };

    // All events that count as "user is present"
    const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "touchmove", "scroll", "click", "visibilitychange"];
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));

    reset(); // start the clock

    return () => {
      clearTimeout(timer);
      EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [session?.user]);

  return null;
}
