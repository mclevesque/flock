/**
 * Push a notification to a user's PartyKit notification room.
 * Called from Next.js API routes after DB writes.
 * Fire-and-forget — non-blocking, errors are silently ignored.
 */
export async function pushNotification(targetUserId: string, payload: Record<string, unknown>) {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  if (!host || host === "DISABLED") return;

  fetch(`https://${host}/parties/notifications/${encodeURIComponent(targetUserId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
