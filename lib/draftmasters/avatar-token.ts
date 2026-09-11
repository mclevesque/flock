import crypto from "crypto";

/**
 * A short-lived permission slip for writing one avatar to R2.
 *
 * R2 writes cannot happen from a Next route in production (see lib/storage.ts
 * — Turbopack cannot ship the AWS SDK), so the bytes go through a Netlify
 * function instead. That function has no session, and an unauthenticated
 * endpoint that writes into avatars/ is an open bucket. So the Next route,
 * which does have the session, signs "user X may upload until T" and the
 * function checks the signature with the same secret.
 *
 * netlify/functions/avatar-store.ts carries its own copy of verify() — it is
 * bundled separately and cannot import from here.
 */

const TTL_MS = 5 * 60 * 1000;

export function tokenSecret(): string | null {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

/** Path-safe user id: ids are uuids and local_/guest_ strings, but never trust that. */
export function safeUserId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
}

export function signAvatarToken(userId: string, now = Date.now()): string | null {
  const secret = tokenSecret();
  if (!secret) return null;
  const uid = safeUserId(userId);
  const exp = now + TTL_MS;
  const mac = crypto.createHmac("sha256", secret).update(`avatar:${uid}:${exp}`).digest("base64url");
  return `${uid}.${exp}.${mac}`;
}
