"use client";
import { useEffect } from "react";

// Registers service worker and stashes the beforeinstallprompt event globally
// so HubClient can pick it up and trigger the native install dialog.
export default function PWAInstall() {
  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Stash the deferred install prompt globally for HubClient to consume
    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return null;
}
