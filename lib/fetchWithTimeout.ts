"use client";

/**
 * fetch() with a built-in timeout + automatic abort on unmount.
 * Pass the AbortSignal from your useEffect cleanup to also cancel on unmount.
 *
 * Usage:
 *   const res = await fetchWithTimeout('/api/vibe', {}, 5000);
 *   const res = await fetchWithTimeout('/api/vibe', { signal: controllerSignal }, 5000);
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000,
): Promise<Response> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Merge caller's signal with timeout signal
  const signal = options.signal
    ? anySignal([options.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    return await fetch(url, { ...options, signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Returns an AbortSignal that aborts when ANY of the given signals abort */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) { controller.abort(); break; }
    sig.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

/**
 * Creates an AbortController that auto-aborts after timeoutMs.
 * Use in useEffect: const { signal, cleanup } = makeSignal(5000);
 *                   return cleanup;
 */
export function makeSignal(timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => { controller.abort(); clearTimeout(timer); },
  };
}
